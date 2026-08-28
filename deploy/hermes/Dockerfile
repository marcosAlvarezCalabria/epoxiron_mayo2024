FROM nousresearch/hermes-agent:v2026.8.27

USER root

# Telegram voice messages use the configured local STT provider. Install the
# dependency in the image so gateway turns never attempt a lazy install.
RUN uv pip install \
      --python /opt/hermes/.venv/bin/python3 \
      "faster-whisper==1.2.1" \
    && /opt/hermes/.venv/bin/python3 -c "import faster_whisper"
