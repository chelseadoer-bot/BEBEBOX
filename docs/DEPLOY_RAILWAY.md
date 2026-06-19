# BEBEBOX Railway 배포 가이드

## 총 소요 시간: 약 10분

---

## 1단계 — Railway 가입 (2분)

1. https://railway.app 접속
2. **"Login with GitHub"** 클릭 → GitHub 계정으로 가입/로그인
3. 카드 등록 없이도 **월 $5 무료 크레딧**으로 시작 가능

---

## 2단계 — 프로젝트 생성 (1분)

1. **"New Project"** 클릭
2. **"Deploy from GitHub repo"** 선택
3. **BEBEBOX** 저장소 선택 → **"Deploy Now"**
4. 잠시 기다리면 빌드 + 배포 시작 (약 2~3분)

---

## 3단계 — 영구 디스크(볼륨) 추가 (2분)

> 이걸 해야 재배포해도 사진·데이터가 유지됩니다.

1. 프로젝트 화면에서 **"+ New"** → **"Volume"** 클릭
2. Mount Path: `/data` 입력 → **"Add"**

---

## 4단계 — 환경변수 입력 (2분)

서비스 클릭 → **"Variables"** 탭에서 아래 값 추가:

| Variable | Value |
|----------|-------|
| `BEBEBOX_DATA_DIR` | `/data` |
| `BEBEBOX_UPLOAD_DIR` | `/data/uploads` |
| `KAKAO_REST_API_KEY` | (카카오 REST API 키) |
| `KAKAO_CLIENT_SECRET` | (카카오 클라이언트 시크릿) |
| `KAKAO_REDIRECT_URI` | 일단 비워두고 5단계 이후 채움 |

---

## 5단계 — 도메인 확인 후 카카오 설정 (2분)

1. Railway 서비스 → **"Settings"** → **"Networking"** → **"Generate Domain"** 클릭
2. 생성된 주소(예: `bebebox-production.up.railway.app`) 복사
3. `KAKAO_REDIRECT_URI` 값을 아래로 업데이트:
   ```
   https://<생성된-주소>/auth/kakao/callback
   ```
4. 카카오 개발자 콘솔(https://developers.kakao.com) → **앱 → 제품 링크 관리 → 웹 도메인** 에 추가:
   ```
   https://<생성된-주소>
   ```
5. **앱 → 플랫폼 키 → REST API 키** → **리다이렉트 URI** 에 추가:
   ```
   https://<생성된-주소>/auth/kakao/callback
   ```

---

## 완료!

`https://<생성된-주소>` 로 접속 → 카카오 로그인 → 가족에게 링크 공유

### 이후 업데이트

코드 수정 후 `git push` 하면 Railway가 **자동으로 재배포**합니다.  
데이터는 볼륨(`/data`)에 보존됩니다.
