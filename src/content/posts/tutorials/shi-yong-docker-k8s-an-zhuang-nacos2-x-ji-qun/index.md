---
title: "使用docker-k8s安装nacos2.x集群"
published: 2022-05-13
description: "去github上下载对应版本的包 执行里面的sql文件导入到数据库即可"
tags: ["k8s","docker","nacos","集群"]
category: "中间件"
draft: false
lang: zh_CN
---

### 下载nacos-k8s

```shell
https://github.com/nacos-group/nacos-k8s.git
```

### 安装[nacos-operator](https://github.com/nacos-group/nacos-k8s/blob/master/operator/README-CN.md)

```shell

helm install nacos-operator ./chart/nacos-operator

# 如果没有helm, 使用kubectl进行安装, 默认安装在default下面
kubectl apply -f chart/nacos-operator/nacos-operator-all.yaml
```

### 配置数据库

去github上下载对应版本的包 执行里面的sql文件导入到数据库即可

https://github.com/alibaba/nacos/releases

### 修改部署文件-使用自己的MySQL

nacos-k8s/nacos-k8s-master/operator/config/samples/nacos_cluster_mysql.yaml

```yaml
apiVersion: nacos.io/v1alpha1
kind: Nacos
metadata:
  name: nacos
  namespace: demo-project
spec:
  type: cluster
  image: nacos/nacos-server:v2.1.0
  replicas: 3
  resources:
    requests:
      cpu: 100m
      memory: 512Mi
    limits:
      cpu: 1
      memory: 2Gi
  database:
    type: mysql
    mysqlHost: 127.0.0.1
    mysqlDb: nacos
    mysqlUser: tianch
    mysqlPort: "3306"
    mysqlPassword: "123456"
```

### 创建集群

```shell
kubectl apply -f nacos-k8s/nacos-k8s-master/operator/config/samples/nacos_cluster_mysql.yaml
```

![image-20220513151754058](https://blog.tianch.com.cn/img/image-20220513151754058.png)

