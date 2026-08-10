---
title: "k8s+helm安装skywalking(使用已经存在的Elasticsearch )"
published: 2022-01-27
description: "我安装时的最新版本是封装的4.2.0版本 注意你下载时的版本"
tags: ["k8s","skywalking","Elasticsearch"]
category: "中间件"
draft: false
lang: zh_CN
---

1. 添加仓库

   ```shell
   helm repo add skywalking https://apache.jfrog.io/artifactory/skywalking-helm
   ```

2. 创建工作目录

   ```shell
   mkdir -p /opt/skywalking
   ```

3. 下载包

   ```shell
   helm pull skywalking/skywalking
   ```

4. 解压安装包并进入解压后的目录

   我安装时的最新版本是封装的4.2.0版本 注意你下载时的版本

   ```shell
   tar -xvf skywalking-4.2.0.tgz
   cd skywalking
   ```

5. 编辑`values-my-es.yaml`文件

   host填写你的host和port以及用户名和密码

   ```shell
   oap:
     image:
       tag: 8.8.1
     storageType: elasticsearch

   ui:
     image:
       tag: 8.8.1

   elasticsearch:
     enabled: false
     config:               # For users of an existing elasticsearch cluster,takes effect when `elasticsearch.enabled` is false
       host: elasticsearch-master.demo-project
       port:
         http: 9200
       user: ""         # [optional]
       password: ""     # [optional]
   ```

6. 安装

   ```shell
   helm install skywalking . -n demo-project -f values-my-es.yaml
   ```

   `.`表示当前目录

   `-n demo-project`表示指定命名空间`demo-project`

