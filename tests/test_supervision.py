import numpy as np
import pytest
from training.lambdamart.supervision import derive_relevance


def test_labels_come_from_note_and_column_features_not_topic_tags():
    candidates = [
        {'id':'a','n':[1,0,0],'m':[1,0,0,0,0,0],'topic':'wrong'},
        {'id':'b','n':[0,1,0],'m':[0,1,0,0,0,0],'topic':'wrong'},
        {'id':'c','n':[0,0,1],'m':[0,0,1,0,0,0],'topic':'wrong'},
    ]
    first = derive_relevance({'n':[1,0,0],'m':[1,0,0,0,0,0]},candidates)
    second = derive_relevance({'n':[0,1,0],'m':[0,1,0,0,0,0]},candidates)
    assert first['labels'] == [3,0,0]
    assert second['labels'] == [0,3,0]
    assert first['scores'] == [1,0,0]


def test_equal_block_weights_and_ties():
    result = derive_relevance({'n':[1,0],'m':[1,0,0,0]},[
        {'n':[1,0],'m':[0,1,0,0]},
        {'n':[0,1],'m':[1,0,0,0]},
        {'n':[0,1],'m':[0,1,0,0]},
    ])
    assert result['scores'] == [.5,.5,0]
    assert result['labels'] == [3,3,0]
    with pytest.raises(ValueError,match='NO_SUPERVISION_SIGNAL'):
        derive_relevance({'n':[0,0],'m':[0,0]},[{'n':[1,0],'m':[1,0]},{'n':[0,1],'m':[0,1]}])
    with pytest.raises(ValueError,match='INVALID_SUPERVISION_FEATURE'):
        derive_relevance({'n':[np.nan],'m':[1]},[{'n':[1],'m':[1]},{'n':[2],'m':[2]}])
