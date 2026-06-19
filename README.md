# 베베박스 (BEBEBOX)

아기 성장 기록, 가족 공유, 위시리스트, 퍼즐 미션을 담은 웹 앱입니다.

## 요구 사항

- Python 3.8 이상
- Google Gemini API KEY ([발급 링크](https://aistudio.google.com/apikey))

## 실행 방법

### Windows

1. `start.bat` 더블클릭
2. 처음 실행 시 Gemini API KEY 입력
3. 브라우저에서 http://localhost:8080 접속

### Mac / Linux

```bash
cp .env.example .env
# .env 파일을 열어 GEMINI_API_KEY= 뒤에 본인 키 입력
python server.py
```

## API KEY 안내

- **`.env` 파일은 Git에 올라가지 않습니다.** 각자 로컬에서만 사용하세요.
- `.env.example` 은 템플릿이며, 실제 키는 넣지 않습니다.
- 키디키디 상품 검색은 별도 API KEY 없이 동작합니다 (서버 프록시 사용).

## 프로젝트 구조

```
├── index.html          # 메인 UI
├── server.py           # 정적 파일 + 키디키디 API 프록시
├── start.bat           # Windows 실행 (API KEY 입력)
├── .env.example        # 환경변수 템플릿
├── css/                # 스타일
├── js/                 # 앱 로직
├── public/             # 아이콘, 데모 사진
└── scripts/            # 키디키디 API 탐색 스크립트
```

## 주의

`python -m http.server` 로만 실행하면 키디키디 상품 검색 API가 동작하지 않습니다. 반드시 `python server.py` 또는 `start.bat` 으로 실행하세요.
