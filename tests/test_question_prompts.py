import pytest
from pydantic import ValidationError
from services.questions.prompts import QuestionInput, render_question_input


def payload(q=None, body='친구와 놀이하는 장면을 관찰한다.'):
    return QuestionInput(q=q if q is not None else [65, 50, 55, 60, 45, None],
                         column={'title': '또래 관계', 'body': body})


def test_render_child_state_and_column_without_interpreting_scores():
    result = render_question_input(payload())
    system, user = result['messages']
    assert result['promptVersion'] == 'question-child-state-v2'
    assert system['role'] == 'system' and user['role'] == 'user'
    assert '주의집중 문제 T점수 (attention_problems_t): 65' in user['content']
    assert '위축 T점수 (withdrawn_t): 미제공' in user['content']
    assert len([line for line in user['content'].splitlines() if line.startswith('- ')]) == 6
    assert '또래 관계' in user['content'] and '친구와 놀이하는 장면' in user['content']
    assert '주어지지 않은 나이' in system['content']
    other = render_question_input(payload([30, 40, 50, 60, 70, 80]))
    assert other['messages'][1]['content'] != user['content']


def test_column_text_is_data_not_a_template():
    result = render_question_input(payload(body='{{ 7 * 7 }}\n{% include "secret" %}'))
    assert '{{ 7 * 7 }}' in result['messages'][1]['content']
    assert '49' not in result['messages'][1]['content']


@pytest.mark.parametrize('q', [[1]*5, [101]*6, [float('nan')]*6, [True]*6, ['65']*6])
def test_reject_invalid_child_state(q):
    with pytest.raises(ValidationError):
        payload(q)


def test_supplied_report_scale_definitions_and_kind_specific_criteria():
    result = render_question_input(payload([66, 58, 61, 63, 62, 60]))
    system, user = [m['content'] for m in result['messages']]
    assert '종합척도와 개별 척도를 구분' in system
    assert '제공 보고서 기준: 정상 T<60, 준임상 60≤T<63, 임상 T≥63' in user
    assert '제공 보고서 기준: 정상 T<60, 준임상 60≤T<70, 임상 T≥70' in user
    # Identical values must retain different scale kinds, not a shared 63T cutoff.
    same = render_question_input(payload([66, 58, 63, 63, 62, 60]))['messages'][1]['content']
    internalizing = same.split('- 내재화 T점수', 1)[1].split('- 우울/불안', 1)[0]
    depressed = same.split('- 우울/불안 T점수', 1)[1].split('- 사회적 미성숙', 1)[0]
    assert '종합척도' in internalizing and '위축·신체증상·우울/불안' in internalizing
    assert '개별 증후군 척도' in depressed and '걱정·긴장·불안' in depressed
    assert '117문항' in user and '또래 관계 형성·유지' in user
    assert '사회능력 척도의 사회성과는 별개' in user
    assert '입력에 없는 점수를 0·정상으로 처리하지 않는다' in user
    for name in ['외현화 문제', '신체증상', '사고의 문제', '비행', '공격성',
                 '사회성', '학업수행', '총 사회능력', '정서불안정', '성문제']:
        assert name in user


def test_reference_case_facts_are_not_assigned_to_other_children():
    user = render_question_input(payload([None]*6))['messages'][1]['content']
    for phrase in ['김인사', '남아', '7세 3개월', '학교에서는 산만', '친구들과 잘 어울리지 못']:
        assert phrase not in user
    assert user.count(': 미제공') >= 6
    assert '점수·실시 여부 미제공' in user
    assert '미실시와 단순 미제공도 구분' in user
