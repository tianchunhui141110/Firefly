---
title: "k8s+helm安装Elasticsearch集群"
published: 2022-01-27
description: "基本不用改什么东西"
tags: ["k8s","Elasticsearch","集群"]
category: "中间件"
draft: true
lang: zh_CN
---

1. 添加仓库

   ```shell
   helm repo add elastic https://helm.elastic.co
   ```

2. 创建工作目录并进入工作目录

   ```shell
   mkdir -p /opt/elasticsearch
   cd /opt/elasticsearch
   ```

3. 下载安装包

   ```shell
   helm pull helm pull elastic/elasticsearch --version 7.5.1
   ```

4. 解压安装包

   ```shell
   tar -xvf elasticsearch-7.5.1.tgz
   ```

5. 进入解压后的目录

   ```shell
   cd elasticsearch
   ```

6. 编辑`values.yaml`文件

   ```shell
   vim values.yaml
   ```

   基本不用改什么东西

7. 安装

   ```shell
   helm install elasticsearch . -n demo-project
   ```

