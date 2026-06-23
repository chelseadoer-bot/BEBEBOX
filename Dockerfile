# BEBEBOX 배포용 이미지
# 본체와 AI 미니앱 대부분은 표준 라이브러리만 사용한다. '브이로그 제작소'
# 한 개만 ffmpeg(번들 바이너리)가 필요해 requirements.txt 로 설치한다.
FROM python:3.12-slim

WORKDIR /app
COPY . .

RUN pip install --no-cache-dir -r requirements.txt

# 영구 디스크(볼륨)를 /data 에 마운트해서 DB/업로드를 보존한다.
# PORT 는 호스팅 플랫폼이 주입한다(없으면 server.py 가 8080 기본값 사용).
ENV BEBEBOX_DATA_DIR=/data \
    BEBEBOX_UPLOAD_DIR=/data/uploads

EXPOSE 8080

CMD ["python", "server.py"]
