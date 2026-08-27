FROM node:22-slim

# Pin the harness version. The `trueforge` binary runs the standalone server.
ENV NODE_ENV=production
RUN npm install --global @truefoundry/trueforge@0.1.4

# Standalone stores SQLite under ~/.local/share/trueforge. Mount Render's
# persistent disk here so agents/connectors/settings survive restarts.
VOLUME ["/root/.local/share/trueforge"]

CMD ["trueforge"]
