# BEBEBOX 배포용 이미지 (표준 라이브러리만 사용 → 의존성 설치 없음)
FROM python:3.12-slim

WORKDIR /app
COPY . .

# 영구 디스크(볼륨)를 /data 에 마운트해서 DB/업로드를 보존한다.
ENV PORT=8080 \
    BEBEBOX_DATA_DIR=/data \
    BEBEBOX_UPLOAD_DIR=/data/uploads

EXPOSE 8080

CMD ["python", "server.py"]
