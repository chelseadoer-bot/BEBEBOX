# 카카오 로그인 설정

## 1. 카카오 개발자 앱 만들기

1. [developers.kakao.com](https://developers.kakao.com) 로그인
2. **내 애플리케이션** > **애플리케이션 추가하기**
3. 앱 이름: `BEBEBOX` (원하는 이름)

## 2. 플랫폼 등록

**앱 설정 > 플랫폼 > Web**

- 사이트 도메인: `http://localhost:8080`

## 3. Redirect URI 등록

**앱 설정 > 카카오 로그인 > Redirect URI**

```
http://localhost:8080/auth/kakao/callback
```

**카카오 로그인** 활성화 ON

## 4. 동의항목 (선택)

**카카오 로그인 > 동의항목**

- 닉네임: 필수
- 프로필 사진: 선택
- 카카오계정(이메일): 선택

## 5. 키 복사

**앱 설정 > 앱 키**

| 키 | .env 변수 |
|----|-----------|
| REST API 키 | `KAKAO_REST_API_KEY` |

**앱 설정 > 보안 > Client Secret**

- Client Secret 코드 생성 ON
- 코드 복사 → `KAKAO_CLIENT_SECRET`

## 6. .env 설정

```env
KAKAO_REST_API_KEY=your_rest_api_key
KAKAO_CLIENT_SECRET=your_client_secret
KAKAO_REDIRECT_URI=http://localhost:8080/auth/kakao/callback
```

`start.bat` 실행 시 입력할 수도 있습니다.

## 7. 테스트

```bash
python server.py
```

브라우저에서 **카카오로 시작하기** 클릭 → 카카오 로그인 → 온보딩 진행

## 배포 시

Redirect URI와 Web 도메인에 실제 URL(예: `https://your-domain.com`)을 추가하세요.
