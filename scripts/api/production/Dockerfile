# node 12, mantenance LTS start from: 2020-11-30 to 2022-04-30
# ref: https://nodejs.org/en/about/releases/
FROM node:14.16.0

RUN apt-get update && apt-get install -y --no-install-recommends \
    graphicsmagick  && \
    apt-get clean

# imagemagick
#                           curl git sudo make g++ graphicsmagick imagemagick

WORKDIR /camera-trap-api

COPY package.json package-lock.json ./
COPY node_modules/camera-trap-credentials ./node_modules/camera-trap-credentials

RUN npm i --production && \
  rm -rf ~/.npm package-lock.json


ENV NODE_ENV="production-nov"


#CMD ["node", "--max-old-space-size=8192", "src/web-starter"]
CMD ["npm", "run", "start_prod"]
