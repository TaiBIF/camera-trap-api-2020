FROM python:3.8.6-slim

# set environment varibles
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1


# update & install system package
RUN apt-get update && apt-get install -y

# timezone to Asia/Taipei
RUN ln -sf /usr/share/zoneinfo/Asia/Taipei /etc/localtime
RUN echo "Asia/Taipei" > /etc/timezone
ENV TZ=Asia/Taipei

WORKDIR /code/

# install python package
RUN pip install --upgrade pip
RUN pip install --no-cache-dir pipenv
COPY Pipfile Pipfile.lock ./
RUN pipenv install --ignore-pipfile --system

#COPY ./scripts/django/start /code/start
#RUN chmod +x /code/start


