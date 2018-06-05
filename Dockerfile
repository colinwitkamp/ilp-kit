FROM node:7-slim
RUN apt-get update
RUN apt-get -y install curl
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list

RUN apt-get update && apt-get install -y apt-transport-https python postgresql libpq-dev build-essential libpq5 git  yarn

COPY . /usr/src/app
WORKDIR /usr/src/app

RUN yarn install
# native modules need to be rebuilt for the new system
RUN npm rebuild
RUN npm run build

EXPOSE 3010

CMD [ "npm", "start" ]
