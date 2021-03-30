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

#RUN npm install --save-dev

RUN npm i -D && \
  rm -rf ~/.npm package-lock.json




COPY src ./src
COPY config ./config

EXPOSE 3000

ENV NODE_ENV="docker"

#CMD ["node", "src/web-starter"]
CMD ["npm", "run", "start"]