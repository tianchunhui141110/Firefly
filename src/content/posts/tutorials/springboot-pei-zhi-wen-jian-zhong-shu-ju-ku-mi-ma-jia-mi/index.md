---
title: "SpringBoot配置文件中数据库密码加密"
published: 2021-06-24
description: ""
tags: ["Spring"]
category: "Java"
draft: false
lang: zh_CN
---

### **jasypt 加解密** (亲测)

- 引入maven依赖

  ```xml
  <!--数据库账号密码加密-->
  <dependency>
      <groupId>com.github.ulisesbocchio</groupId>
      <artifactId>jasypt-spring-boot-starter</artifactId>
      <version>3.0.3</version>
  </dependency>
  ```

- 配置文件设置盐

  ```yaml
  jasypt:
    encryptor:
      password: salt(混淆的盐 不是数据库密码)
  ```

- 添加测试用例

  ```java
  @Autowired
  StringEncryptor encryptor;

  @Test
  public void jacketEncrypt() {
      //加密
      String username = encryptor.encrypt("root");
      String password = encryptor.encrypt("root");
      System.out.println("name 密文: " + username);
      System.out.println("password 密文: " + password);

      //解密
      String decryptUsername = encryptor.decrypt(username);
      String decryptPassword = encryptor.decrypt(password);
      System.out.println(decryptUsername + ":" + decryptPassword);
  }
  ```

- 执行结果

  ```text
  username 密文: 4JemeydjoOcwvCq2o2bDbzwcHxQr/sH+oO+7A6+r7cEnyNDTPbyRrMrZIVqDekmU
  password 密文: xxdvFS4od9nOskblLD7nyfjt5WEQ2V/8kMHxPfX8LrzMP4h0s6K9Z6XTlYtdwCHv
  root:root
  ```

- 修改配置文件

  ```yaml
  spring:
    datasource:
      url: jdbc:xxxx
      username: ENC(4JemeydjoOcwvCq2o2bDbzwcHxQr/sH+oO+7A6+r7cEnyNDTPbyRrMrZIVqDekmU)
      password: ENC(xxdvFS4od9nOskblLD7nyfjt5WEQ2V/8kMHxPfX8LrzMP4h0s6K9Z6XTlYtdwCHv)
  ```

- 启动类添加注解开启加解密功能

  ```java
  @EnableEncryptableProperties
  ```

