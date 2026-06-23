# -*- coding: utf-8 -*-
"""기질 검사 규칙 (기존 apps/ktype.html 로직 이식, 서버 규격화).
프론트는 16문항의 장면/질문/선택지 텍스트만 표시하고, 채점은 서버에서 수행한다.
answers: 길이 16의 정수 배열(각 0~2, 선택지 순서 = 순한/느린/까다로운).
"""

OPTION_TYPES = ["easy", "slow", "difficult"]
TOTAL_Q = 16

RESULT_DATA = {
    "easy": {
        "code": "E",
        "name": "순한 아이",
        "ratio": "약 40% 정도",
        "hashtags": ["#명랑함", "#규칙적", "#적응력UP"],
        "description": [
            "명랑하며 식습관, 수면습관, 배변활동 등 생물학적 기능이 규칙적이에요.",
            "새로운 환경에 쉽게 적응할 수 있어요.",
            "상황에 유연성이 있어서 부모가 다루기에 큰 어려움이 없어요.",
        ],
        "parenting": "아이에게 다양한 자극에 노출시켜 발달이 지연되지 않도록 환경을 제공해 주는 것이 바람직해요. 온순하다고 혼자서 지내는 시간이 많아지지 않도록 부모는 항상 아이에게 관심을 가져줘야 해요. 아이가 울기 전에 식사, 기저귀 갈기 등 필요한 부분을 세심하게 챙겨주세요.",
    },
    "slow": {
        "code": "S",
        "name": "느린 아이",
        "ratio": "약 15% 정도",
        "hashtags": ["#천천히", "#수줍음", "#섬세함"],
        "description": [
            "순한 아이에 비해 변화에 적응하는데 시간이 좀 더 많이 걸려요.",
            "활동성이 높기보다는 온순한 반응을 보여요.",
            "수줍음, 침묵 등 온순한 방법으로 새로운 상황을 회피하는 경향이 있어요.",
            "새로운 사람을 만나거나 환경에서는 별다른 반응 없어 보이는 모습은 사실 아이는 긴장하고 떨리는 상황일 수도 있어요.",
        ],
        "parenting": "새로운 자극에 익숙해지는 데 시간이 오래 걸려서 다양한 활동보다는 한 가지 활동에 집중할 수 있게 하여 충분히 적응할 수 있는 시간을 제공해주는 것이 필요해요. \"왜 말을 안해?\", \"왜 이렇게 수줍어해?\" 등의 말은 아이를 더 위축시킬 수 있으니, 아이가 충분히 주위를 둘러보며 경계를 풀고 적응할 수 있도록 기다려주세요. 수줍어하거나 소극적이라고 다그치지 마시고 조금만 기다려주면 우리 아이도 잘 적응할 수 있어요.",
    },
    "difficult": {
        "code": "D",
        "name": "까다로운 아이",
        "ratio": "약 10% 정도",
        "hashtags": ["#예민함", "#개성있는", "#특별함"],
        "description": [
            "잘 보채고 새로운 환경에 대해 부정적으로 반응하며 회피하려고 해요.",
            "생물학적 기능도 불규칙적이에요.",
            "때로는 왜 우는지 알 수 없을 정도로 심하게 울 수 있어요.",
            "감정 표현이 강한 만큼, 자신의 의사를 분명히 전달할 줄 아는 아이에요.",
        ],
        "parenting": "자극에 대해 매우 예민하므로, 우선 자극이 별로 없는 편안한 환경을 제공하며 민감하게 아이의 상태를 파악하여 대처해야 해요. 아이의 기질 특성을 이해하고 아이가 환경에 잘 적응할 수 있도록 도와주는 양육이 필요해요. 이 과정에서 때론 부모가 지쳐 아이에게 감정적으로 대하는 일이 없도록 조심해야 해요.",
    },
}


def _mixed_result(primary, secondary):
    p = RESULT_DATA[primary]
    s = RESULT_DATA[secondary]
    code = "%s%s 혼합유형" % (p["code"], s["code"])
    return {
        "code": code,
        "name": code,
        "ratio": "약 35% 정도",
        "hashtags": p["hashtags"][:2] + s["hashtags"][:1],
        "description": p["description"][:2] + s["description"][:2],
        "parenting": "우리 아이는 %s의 특성과 %s의 특성이 함께 보이는 혼합유형이에요. 식습관, 새로운 환경에 대한 적응, 낯선 사람에 대한 반응, 좌절에 대한 반응, 정서 등 어떤 부분에서 아이가 어떤 유형을 보이는지 잘 파악하는 것이 중요해요. 잘하는 부분은 지속적으로 잘 적응하도록 관심과 격려를 보이며, 예민하고 느린 부분에 대해서는 기다려주고 천천히 자극을 받아들일 수 있도록 지도해주세요." % (p["name"], s["name"]),
    }


def diagnose(answers):
    counts = {"easy": 0, "slow": 0, "difficult": 0}
    for a in answers:
        if a is None:
            continue
        try:
            t = OPTION_TYPES[int(a)]
        except (IndexError, ValueError, TypeError):
            continue
        counts[t] += 1

    order = ["easy", "slow", "difficult"]
    sorted_types = sorted(order, key=lambda k: counts[k], reverse=True)
    first, second = sorted_types[0], sorted_types[1]

    if counts[first] / TOTAL_Q >= 0.6:
        result = dict(RESULT_DATA[first])
        result["isMixed"] = False
    elif counts[first] - counts[second] <= 3:
        result = _mixed_result(first, second)
        result["isMixed"] = True
    else:
        result = dict(RESULT_DATA[first])
        result["isMixed"] = False

    result["counts"] = counts
    return result
