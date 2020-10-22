# node 12, mantenance LTS start from: 2020-11-30 to 2022-04-30
# ref: https://nodejs.org/en/about/releases/
FROM node:12

RUN apt-get update && apt-get install -y --no-install-recommends \
    graphicsmagick  && \
    apt-get clean

# imagemagick
#                           curl git sudo make g++ graphicsmagick imagemagick

COPY package.json package-lock.json ./
COPY node_modules/camera-trap-credentials ./node_modules/camera-trap-credentials

RUN npm install

#RUN npm i -D && \
#  rm -rf ~/.npm package-lock.json


WORKDIR /camera-trap-api

COPY src ./src
COPY config ./config

EXPOSE 3000

ENV NODE_ENV="docker"

#CMD ["npm", "src/web-starter"]
CMD ["npm", "run", "start"]
