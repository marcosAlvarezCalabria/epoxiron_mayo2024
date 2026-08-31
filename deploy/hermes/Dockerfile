FROM nousresearch/hermes-agent:v2026.8.27

USER root

COPY 014-cache-permissions /etc/cont-init.d/014-cache-permissions

# Telegram voice messages use the configured local STT provider. Install the
# dependency in the image so gateway turns never attempt a lazy install.
RUN chmod 0755 /etc/cont-init.d/014-cache-permissions \
    && uv pip install \
      --python /opt/hermes/.venv/bin/python3 \
      "faster-whisper==1.2.1" \
    && /opt/hermes/.venv/bin/python3 -c "import faster_whisper"
