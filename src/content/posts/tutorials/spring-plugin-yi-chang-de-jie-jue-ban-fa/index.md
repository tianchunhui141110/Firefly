---
title: "spring-plugin异常的解决办法"
published: 2021-02-20
description: "在学习ES的过程中，本着有最新就用最新的想法，使用了springboot2.3.x的版本，在实操过程中遇到了配置和方法过时的情况，于是将springboot版本降级为2.1.13，诡异的事情发生了，原本能正常启动的项目起不来了，报错如下："
tags: ["运维"]
category: "其他"
draft: false
lang: zh_CN
---

在学习ES的过程中，本着有最新就用最新的想法，使用了springboot2.3.x的版本，在实操过程中遇到了配置和方法过时的情况，于是将springboot版本降级为2.1.13，诡异的事情发生了，原本能正常启动的项目起不来了，报错如下：

```html
*************************** APPLICATION FAILED TO START
*************************** Description: An attempt was made to call a method
that does not exist. The attempt was made from the following location:
springfox.documentation.schema.plugins.SchemaPluginsManager.viewProvider(SchemaPluginsManager.java:95)
The following method did not exist:
org.springframework.plugin.core.PluginRegistry.getPluginFor(Ljava/lang/Object;)Ljava/util/Optional;
The method's class, org.springframework.plugin.core.PluginRegistry, is available
from the following locations:
jar:file:/D:/repository/org/springframework/plugin/spring-plugin-core/1.2.0.RELEASE/spring-plugin-core-1.2.0.RELEASE.jar!/org/springframework/plugin/core/PluginRegistry.class
It was loaded from the following location:
file:/D:/repository/org/springframework/plugin/spring-plugin-core/1.2.0.RELEASE/spring-plugin-core-1.2.0.RELEASE.jar
Action: Correct the classpath of your application so that it contains a single,
compatible version of org.springframework.plugin.core.PluginRegistry
```

百度了一下问题，遇到了类似问题的帖子，就试了试

一开始使用了1.2.0的版本，但是问题依旧存在，又把帖子往下划拉了划拉，试了试2.0.0版本的，嘿，还真好使了

问题原因：版本冲突

```xml
<dependency>
    <groupId>org.springframework.plugin</groupId>
    <artifactId>spring-plugin-core</artifactId>
    <version>2.0.0.RELEASE</version>
</dependency>
<dependency>
    <groupId>org.springframework.plugin</groupId>
    <artifactId>spring-plugin-metadata</artifactId>
    <version>2.0.0.RELEASE</version>
</dependency>
```

参考：https://ask.csdn.net/questions/754747

