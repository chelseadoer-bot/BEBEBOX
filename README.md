# 베베박스 (BEBEBOX)

아기 성장 기록, 가족 공유, 위시리스트, 퍼즐 미션을 담은 웹 앱입니다.

## 🚀 한 번에 배포하기 (여러 사람과 공유)

다른 가족·지인과 사진·위시리스트를 **함께** 쓰려면 서버를 한 곳에 올려야 합니다.
아래 버튼을 누르면 Render가 이 저장소의 `render.yaml` 을 읽어 웹 서비스 + 영구 디스크를 자동으로 만들어 줍니다.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/chelseadoer-bot/bebebox)

> 영구 디스크(사진·DB 보존)는 Render 유료 **Starter** 플랜(약 $7/월)이 필요합니다.
> 카카오 로그인 없이도 **가족 코드**만 같으면 사진·데이터가 공유됩니다. 자세한 절차는 [docs/DEPLOY.md](docs/DEPLOY.md).

## 요구 사항

- Python 3.8 이상 (표준 라이브러리만 사용 — 추가 설치 없음)
- (선택) Google Gemini API KEY ([발급 링크](https://aistudio.google.com/apikey))

> 백엔드는 **외부 계정/서비스 없이** 로컬에서 동작합니다.
> 데이터는 `data/bebebox.db`(SQLite)에, 사진 파일은 `uploads/`에 저장됩니다.

## 실행 방법

### Windows

1. `start.bat` 더블클릭
2. 처음 실행 시 안내에 따라 키 입력(모두 선택 — Enter로 건너뛰기 가능)
3. 브라우저에서 http://localhost:8080 접속

### Mac / Linux

```bash
cp .env.example .env
# .env 파일을 열어 GEMINI_API_KEY= 뒤에 본인 키 입력
python server.py
```

## API KEY 안내

- **`.env` 파일은 Git에 올라가지 않습니다.**
- 모든 키는 선택 사항입니다. 없어도 사진 저장/공유/위시리스트 등 기본 기능은 모두 동작합니다.
- 카카오 로그인: [docs/KAKAO_SETUP.md](docs/KAKAO_SETUP.md)

## 카카오 로그인

1. [카카오 개발자](https://developers.kakao.com)에서 앱 생성
2. Redirect URI: `http://localhost:8080/auth/kakao/callback`
3. `.env`에 `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET` 입력
4. `python server.py` 실행 후 **카카오로 시작하기** 클릭

## 프로젝트 구조

```
├── index.html          # 메인 UI
├── server.py           # HTTP 서버 + API 라우팅 + 키디키디 프록시
├── db.py               # SQLite 데이터 계층 (photos / family_data / sessions)
├── kakao_auth.py       # 카카오 OAuth
├── start.bat           # Windows 실행 (API KEY 입력)
├── .env.example        # 환경변수 템플릿
├── css/                # 스타일
├── js/                 # 앱 로직
├── public/             # 아이콘, 데모 사진
├── data/               # SQLite DB (자동 생성)
└── uploads/            # 업로드된 사진 파일
```

## 백엔드 / 데이터 저장

별도 클라우드 계정 없이 로컬에서 완결됩니다.

| 데이터 | 저장 위치 |
|--------|-----------|
| 사진 메타데이터 | `data/bebebox.db` (SQLite, `photos` 테이블) |
| 사진 이미지 파일 | `uploads/` |
| 가족 앱 상태(위시리스트·펀딩·프로필 등) | `data/bebebox.db` (`family_data` 테이블) |
| 로그인 세션 | `data/bebebox.db` (`sessions` 테이블) |

- 같은 초대 코드(가족 코드)를 쓰면 같은 서버에 접속한 기기끼리 사진/데이터가 공유됩니다.
- DB와 업로드 파일은 `.gitignore`로 커밋에서 제외됩니다.
- 외부에 공유하려면 이 서버를 호스팅하거나 같은 네트워크에서 접속하면 됩니다.

## 주의

`python -m http.server` 로만 실행하면 키디키디 상품 검색 API가 동작하지 않습니다. 반드시 `python server.py` 또는 `start.bat` 으로 실행하세요.
