---
title: "使用docker-compose安装skywalking和elasticsearch"
published: 2026-01-05
description: ""
tags: ["docker","skywalking"]
category: "中间件"
draft: false
lang: zh_CN
---

### 安装docker-compose(已安装好docker)

- 下载最新版的docker-compose文件

  ```shell
  sudo curl -L https://github.com/docker/compose/releases/download/v2.2.3/docker-compose-`uname -s`-`uname -m` -o /usr/local/bin/docker-compose
  ```

- 赋予可执行权限

  ```shell
  chmod +x /usr/local/bin/docker-compose
  ```

- 验证版本

  ```shell
  docker-compose --version
  ```

### 编辑docker-compose文件

```yaml
version: "3.3"
services:
  elasticsearch:
    image: elasticsearch:7.6.2
    container_name: elasticsearch
    restart: always
    privileged: true
    hostname: elasticsearch
    ports:
      - 9200:9200
      - 9300:9300
    environment:
      - discovery.type=single-node
      - bootstrap.memory_lock=true
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
      - TZ=Asia/Shanghai
    networks:
      - skywalking
    ulimits:
      memlock:
        soft: -1
        hard: -1
  elasticsearch-hq:
    image: elastichq/elasticsearch-hq
    container_name: elasticsearch-hq
    restart: always
    privileged: true
    hostname: elasticsearch-hq
    ports:
      - 5000:5000
    environment:
      - TZ=Asia/Shanghai
    networks:
      - skywalking
  oap:
    image: apache/skywalking-oap-server:8.3.0-es7
    container_name: oap
    hostname: oap
    privileged: true
    depends_on:
      - elasticsearch
    links:
      - elasticsearch
    restart: always
    ports:
      - 11800:11800
      - 12800:12800
    environment:
      SW_STORAGE: elasticsearch7
      SW_STORAGE_ES_CLUSTER_NODES: elasticsearch:9200
      TZ: Asia/Shanghai
    volumes:
      - ./config/alarm-settings.yml:/skywalking/config/alarm-settings.yml
    networks:
      - skywalking
  ui:
    image: apache/skywalking-ui:8.3.0
    container_name: ui
    privileged: true
    depends_on:
      - oap
    links:
      - oap
    restart: always
    ports:
      - 8080:8080
    environment:
      SW_OAP_ADDRESS: oap:12800
      TZ: Asia/Shanghai
    networks:
      - skywalking

networks:
  skywalking:
    driver: bridge
```

### 执行安装

```shell
docker-compose up -d
```

