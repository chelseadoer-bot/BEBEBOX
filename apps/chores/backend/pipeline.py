# -*- coding: utf-8 -*-
"""집안일 당번뽑기 파이프라인 (무-LLM).
게임 진행은 클라이언트에서 이뤄지고, 서버는 최종 당번 결정 결과를 규격화해 반환한다.
PERSIST=False 이므로 결과는 적치되지 않는다(완전한 인스턴스).
"""


def run(inputs, ctx):
    participants = inputs.get("participants") or []
    if not isinstance(participants, list):
        participants = []
    participants = [str(p).strip() for p in participants if str(p).strip()]
    chore = (inputs.get("chore") or inputs.get("task") or "").strip()
    winner = (inputs.get("winner") or "").strip()
    mode = inputs.get("mode") or "happy"

    if len(participants) < 2:
        raise ValueError("참가자를 2명 이상 입력해 주세요.")
    if not winner:
        raise ValueError("당번이 아직 결정되지 않았어요.")

    output = {
        "winner": winner,
        "chore": chore,
        "participants": participants,
        "mode": mode,
    }
    return {"output": output, "media": []}
