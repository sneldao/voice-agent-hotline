UPSTASH_URL := env.get("UPSTASH_REDIS_REST_URL", "https://game-corgi-122374.upstash.io")
UPSTASH_TOKEN := env.get("UPSTASH_REDIS_REST_TOKEN", "")

default:
    @just --list

deploy:
    ssh snel-bot "cd /opt/voice-hotline-celo && UPSTASH_REDIS_REST_URL={{UPSTASH_URL}} UPSTASH_REDIS_REST_TOKEN={{UPSTASH_TOKEN}} bash scripts/deploy.sh"

logs:
    ssh snel-bot "pm2 logs voice-hotline-celo --nostream"

status:
    ssh snel-bot "pm2 status voice-hotline-celo"

restart:
    ssh snel-bot "pm2 restart voice-hotline-celo"