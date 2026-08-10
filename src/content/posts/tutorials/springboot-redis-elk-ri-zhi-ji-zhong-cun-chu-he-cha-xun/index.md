---
title: "SpringBoot+Redis+ELK日志集中存储和查询"
published: 2026-01-05
description: "http://www.tianch.xyz/archives/%E4%BD%BF%E7%94%A8docker-compose%E5%AE%89%E8%A3%85skywalking%E5%92%8Celasticsearchmd"
tags: ["Redis","Spring","日志"]
category: "中间件"
draft: false
lang: zh_CN
---

### 安装Elasticsearch

http://www.tianch.xyz/archives/%E4%BD%BF%E7%94%A8docker-compose%E5%AE%89%E8%A3%85skywalking%E5%92%8Celasticsearchmd

增加一些配置

- 进入elasticsearch容器

  ```shell
  docker exec -it elasticsearch bash
  ```

- 编辑config/elasticsearch.yml 追加配置

  ```yaml
  http.cors.enabled: true
  http.cors.allow-origin: "*"
  http.cors.allow-headers: Authorization
  xpack.security.enabled: true
  xpack.security.transport.ssl.enabled: true
  ```

- 重启

  ```shell
  docker restart elasticsearch
  ```

- 设置密码

  ```shell
  bin/elasticsearch-setup-passwords interactive
  ```

- 再重启

  ```shell
  docker restart elasticsearch
  ```

- 设置分片-进到容器中先

  ```shell
  curl -XPUT -u elastic -H "Content-Type:application/json" http://localhost:9200/_cluster/settings -d '{ "persistent": { "cluster": { "max_shards_per_node": 10000 } } }'
  ```

### 安装Kibana

- 拉取镜像

  ```shell
  docker pull kibana:7.6.2
  ```

- 运行容器

  ```shell
  docker run --name kibana --link=elasticsearch --net skywalking_skywalking  -p 5601:5601 -d kibana:7.6.2
  ```

- 修改配置

  ```shell
  docker exec -it kibana bash
  cd config
  vi kibana.yml
  ```

  ```yaml
  # Default Kibana configuration for docker target
  server.name: kibana
  server.host: "0"
  elasticsearch.hosts: ["http://elasticsearch:9200"]
  xpack.monitoring.ui.container.elasticsearch.enabled: true
  i18n.locale: "zh-CN"
  elasticsearch.username: "elastic"
  elasticsearch.password: "123456"
  ```

- 重启

  ```shell
  docker restart kibana
  ```

### 安装Logstash

- 拉取镜像

  ```shell
  docker pull logstash:7.6.2
  ```

- 编辑配置文件

  ```shell
  mkdir -p /data/elk/logstash
  vim /data/elk/logstash/logstash.yml
  ```

  ```yaml
  http.host: "0.0.0.0"
  xpack.monitoring.elasticsearch.hosts: ["http://192.168.0.233:9200"]
  xpack.monitoring.elasticsearch.username: "logstash_system"
  xpack.monitoring.elasticsearch.password: "77589910"
  #path.config: /data/elk/logstash/conf.d/*.conf
  path.config: /data/docker/logstash/conf.d/*.conf
  path.logs: /var/log/logstash
  ```

- 编辑conf文件 就`testlog.conf`

  ```shell
  mkdir /data/elk/logstash/conf.d
  vim /data/elk/logstash/conf.d/testlog.conf
  ```

  ```conf
  input {
      redis {
          codec => json
          data_type => "list"
          key => "logstash-list"
          host => "192.168.0.233"
          port => "6379"
          password => "123456"
          batch_count => 100
          threads => 1
      }
  }

  output {
    elasticsearch {
      hosts => ["192.168.0.233:9200"]
      index => "platform-log-%{+YYYY.MM}"
      user => "elastic"
      password => "77589910"
    }
  }
  ```

- 编辑本地rsyslog配置增加

  ```shell
  vim /etc/rsyslog.conf #增加下面一行
  *.* @@192.168.0.233:5044
  ```

- 重启服务使配置生效

  ```shell
  systemctl restart rsyslog
  ```

- 创建容器

  ```shell
  docker run -d --restart=always --log-driver json-file --log-opt max-size=1000m --log-opt max-file=30 -p 5044:5044 --name logstash -v /data/elk/logstash/logstash.yml:/usr/share/logstash/config/logstash.yml -v /data/elk/logstash/conf.d/:/data/docker/logstash/conf.d/ logstash:7.6.2
  ```

### 发送日志到redis

- 需要的依赖

  ```xml
  <dependency>
      <groupId>de.idealo.logback</groupId>
      <artifactId>logback-redis</artifactId>
  </dependency>

  <dependency>
      <groupId>com.yomahub</groupId>
      <artifactId>tlog-all-spring-boot-starter</artifactId>
  </dependency>

  <dependency>
      <groupId>com.yomahub</groupId>
      <artifactId>tlog-logstash-logback</artifactId>
  </dependency>
  ```

- 设置logback-spring.xml

  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <configuration>

      <appender name="Console" class="ch.qos.logback.core.ConsoleAppender">
          <!--这里替换成AspectLogbackEncoder-->
          <encoder class="com.yomahub.tlog.core.enhance.logback.AspectLogbackEncoder">
              <pattern>%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] %-5level %logger{50} - %msg%n</pattern>
          </encoder>
      </appender>

      <!-- 获取yml中的配置 -->
      <springProperty scope="context" name="redis-host" source="spring.redis.host"/>
      <springProperty scope="context" name="redis-port" source="spring.redis.port"/>
      <springProperty scope="context" name="redis-password" source="spring.redis.password"/>


      <!--程序关闭时关闭redis批处理的钩子-->
      <shutdownHook class="ch.qos.logback.core.hook.DelayingShutdownHook"/>
      <appender name="Logstash" class="net.logstash.logback.appender.LoggingEventAsyncDisruptorAppender">
          <ringBufferSize>131072</ringBufferSize>
          <appender class="de.idealo.logback.appender.RedisBatchAppender">
              <connectionConfig>
                  <!--redis node-->
                  <scheme>NODE</scheme>
                  <host>${redis-host}</host>
                  <port>${redis-port}</port>
                  <password>${redis-password}</password>
                  <key>logstash-list</key>
                  <timeout>20000</timeout>
              </connectionConfig>
              <maxBatchMessages>1000</maxBatchMessages>
              <maxBatchSeconds>10</maxBatchSeconds>
              <encoder charset="UTF-8" class="net.logstash.logback.encoder.LoggingEventCompositeJsonEncoder">
                  <providers>
                      <provider class="com.yomahub.tlog.logstash.logback.TLogLogstashLogbackProvider"/>
                      <!--格式化输出：%d表示日期，%thread表示线程名，%-5level：级别从左显示5个字符宽度%msg：日志消息，%n是换行符-->
                      <pattern>
                          <pattern>
                              {
                              "level": "%level",
                              "thread": "%thread",
                              "class": "%logger{40}",
                              "message": "%message",
                              "stack_trace": "%exception{10}",
                              "client_time": "%d{yyyy-MM-dd HH:mm:ss.SSS}"
                              }
                          </pattern>
                      </pattern>
                      <stackTrace>
                          <throwableConverter class="net.logstash.logback.stacktrace.ShortenedThrowableConverter">
                              <maxDepthPerThrowable>10</maxDepthPerThrowable>
                              <maxLength>4096</maxLength>
                              <shortenedClassNameLength>20</shortenedClassNameLength>
                              <rootCauseFirst>true</rootCauseFirst>
                          </throwableConverter>
                      </stackTrace>
                  </providers>
              </encoder>
          </appender>
      </appender>


      <appender name="Async" class="ch.qos.logback.classic.AsyncAppender">
          <neverBlock>true</neverBlock>
          <appender-ref ref="Logstash"/>
      </appender>


      <logger name="org.springframework" level="ERROR"/>
      <logger name="com.alibaba.cloud.dubbo.metadata.repository.DubboServiceMetadataRepository" level="ERROR"/>
      <logger name="org.springframework.boot.autoconfigure" level="ERROR"/>
      <logger name="org.springframework.data.redis" level="ERROR"/>
      <logger name="com.alibaba" level="ERROR"/>
      <logger name="ch.qos.logback" level="ERROR"/>
      <logger name="com.tianch" level="DEBUG"/>
      <root level="INFO">
          <appender-ref ref="Console"/>
          <appender-ref ref="Async"/>
      </root>
  </configuration>
  ```

