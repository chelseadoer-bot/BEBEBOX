# BEBEBOX 배포 가이드 (Render)

여러 사람이 **같은 데이터(사진·위시리스트 등)** 를 공유하려면 서버를 한 곳에 배포해야 합니다.
이 프로젝트는 Render에서 바로 배포되도록 `Dockerfile` 과 `render.yaml` 이 준비돼 있습니다.

데이터 보존: 사진 파일과 SQLite DB는 Render **영구 디스크(`/data`)** 에 저장돼 재배포·재시작에도 유지됩니다.

---

## 1. Render 가입 (1회)

1. https://render.com 접속 → **GitHub 계정으로 가입/로그인**
2. 결제 정보 등록 (영구 디스크는 유료 플랜 `Starter` 필요, 약 $7/월)

## 2. Blueprint 로 배포

**가장 빠른 방법:** README의 **Deploy to Render** 버튼을 누르면 곧장 Blueprint 화면으로 갑니다.

또는 수동으로:

1. Render 대시보드 → **New +** → **Blueprint**
2. **BEBEBOX** 저장소 선택 → Render가 `render.yaml` 을 자동으로 읽음
3. **Apply** 클릭 → 웹 서비스 + 디스크가 자동 생성됨

> Render가 `main` 브랜치의 `render.yaml` 을 읽습니다(영구 디스크 `/data`, 헬스체크 `/api/config`, push 시 자동 재배포 포함). 별도 환경변수 없이 그대로 배포되며, 카카오 로그인을 쓸 때만 아래 3개 값을 넣으면 됩니다.

## 3. 카카오 환경변수 입력

배포가 시작되면 서비스 주소가 생깁니다 (예: `https://bebebox.onrender.com`).

1. Render 서비스 → **Environment** 탭
2. 아래 3개 값 입력:

| Key | Value |
|-----|-------|
| `KAKAO_REST_API_KEY` | (카카오 REST API 키) |
| `KAKAO_CLIENT_SECRET` | (카카오 클라이언트 시크릿) |
| `KAKAO_REDIRECT_URI` | `https://<내-서비스-주소>/auth/kakao/callback` |

3. 저장하면 자동으로 다시 배포됩니다.

## 4. 카카오 콘솔에 운영 주소 등록

[카카오 개발자 콘솔](https://developers.kakao.com)에서:

- **앱 → 제품 링크 관리 → 웹 도메인**: `https://<내-서비스-주소>` 추가
- **앱 → 플랫폼 키 → REST API 키 → 리다이렉트 URI**: `https://<내-서비스-주소>/auth/kakao/callback` 추가

> 로컬(`http://localhost:8080/...`) 주소는 그대로 두고, 운영 주소를 **추가**하면 둘 다 됩니다.

## 5. 접속

`https://<내-서비스-주소>` 로 접속 → 같은 가족 코드를 쓰는 사람들끼리 사진·데이터가 공유됩니다.

---

## 이후 개발 흐름

- 코드 수정 후 `git push` 하면 Render가 **자동 재배포**합니다 (`autoDeploy: true`).
- 데이터는 디스크에 남아 있어 재배포해도 사라지지 않습니다.
