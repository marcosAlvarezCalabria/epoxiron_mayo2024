FROM golang:1.25-alpine AS build

ARG ENGRAM_REF=v1.16.1

RUN apk add --no-cache build-base git sqlite-dev

WORKDIR /src

RUN git clone --branch "${ENGRAM_REF}" --depth 1 https://github.com/Gentleman-Programming/engram.git .

RUN CGO_ENABLED=1 go build -o /usr/local/bin/engram ./cmd/engram

FROM alpine:3.20

RUN apk add --no-cache ca-certificates sqlite-libs

COPY --from=build /usr/local/bin/engram /usr/local/bin/engram

ENV ENGRAM_DATA_DIR=/var/lib/engram
ENV ENGRAM_PORT=7437

VOLUME ["/var/lib/engram"]

EXPOSE 7437

CMD ["engram", "serve"]
