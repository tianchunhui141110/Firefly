---
title: "k8s+helm安装skywalking"
published: 2022-01-27
description: "我安装时的最新版本是封装的4.2.0版本 注意你下载时的版本"
tags: ["k8s","skywalking"]
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

5. 安装
   - Deploy SkyWalking 8.8.1 & Elasticsearch 7.5.1

     ```shell
     helm install skywalking skywalking/skywalking -n demo-project \
       --set oap.image.tag=8.8.1 \
       --set oap.storageType=elasticsearch \
       --set ui.image.tag=8.8.1 \
       --set elasticsearch.imageTag=7.5.1
     ```

   - Deploy SkyWalking 8.8.1 & Elasticsearch 6.8.6

     ```shell
     helm install skywalking skywalking/skywalking -n demo-project \
       --set oap.image.tag=8.8.1 \
       --set oap.storageType=elasticsearch \
       --set ui.image.tag=8.8.1 \
       --set elasticsearch.imageTag=6.8.6
     ```

   - 自定义
     1. 编辑`values.yaml`

     2. 执行命令安装 在`values.yaml`所在文件夹下执行

        ```shell
        helm install skywalking skywalking/skywalking . -n demo-project
        ```

        注意命令中有个点,`.代表当前目录`

