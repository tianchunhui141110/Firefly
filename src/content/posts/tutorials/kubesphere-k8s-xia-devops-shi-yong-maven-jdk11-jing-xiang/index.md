---
title: "kubesphere+k8s下devops使用maven-jdk11镜像"
published: 2022-05-14
description: "将配置-配置字典-jenkins-casc-config里面maven的image改成"
tags: ["k8s"]
category: "Kubernetes"
draft: false
lang: zh_CN
---

将`配置-配置字典-jenkins-casc-config`里面maven的image改成

```yaml
image: "kubespheredev/builder-maven:v3.2.0jdk11"
```

