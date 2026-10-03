"""Render trusted Jinja templates; report and column values remain input data."""
import json
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, StrictUndefined
from pydantic import BaseModel, ConfigDict, Field, field_validator

ROOT = Path(__file__).resolve().parents[2]
TEMPLATES = Path(__file__).with_name('templates')
PROMPT_VERSION = 'question-child-state-v2'
REFERENCE = json.loads(Path(__file__).with_name('scale_reference.json').read_text())
CONFIG = json.loads((ROOT / 'config/poc.json').read_text())
ENV = Environment(loader=FileSystemLoader(TEMPLATES), undefined=StrictUndefined,
                  autoescape=False, trim_blocks=True, lstrip_blocks=True)
ENV.policies['json.dumps_kwargs'] = {'ensure_ascii': False, 'sort_keys': True}


class ColumnInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    title: str = Field(min_length=1, max_length=500)
    body: str = Field(min_length=1, max_length=100000)


class QuestionInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    q: list[float | None] = Field(min_length=6, max_length=6)
    column: ColumnInput
    repair: bool = False

    @field_validator('q', mode='before')
    @classmethod
    def validate_scores(cls, values):
        if not isinstance(values, list) or any(v is not None and (type(v) not in (float, int) or not 0 <= v <= 100) for v in values):
            raise ValueError('INVALID_Q')
        return values


def render_question_input(payload: QuestionInput) -> dict:
    scales = [dict(id=key, value=value, **REFERENCE['scales'][key])
              for key, value in zip(CONFIG['qFeatureOrder'], payload.q)]
    unavailable = [scale for key, scale in REFERENCE['scales'].items()
                   if key not in CONFIG['qFeatureOrder']]
    return {
        'promptVersion': PROMPT_VERSION,
        'messages': [
            {'role': 'system', 'content': ENV.get_template('instructions.jinja').render()},
            {'role': 'user', 'content': ENV.get_template('input.jinja').render(
                scales=scales, reference=REFERENCE, unavailable_scales=unavailable,
                column=payload.column.model_dump(), repair=payload.repair)},
        ],
    }
