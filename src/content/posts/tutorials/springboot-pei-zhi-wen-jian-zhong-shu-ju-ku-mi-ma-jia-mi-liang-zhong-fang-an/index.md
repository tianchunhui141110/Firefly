---
title: "SpringBoot配置文件中数据库密码加密"
published: 2026-01-05
description: ""
tags: ["Spring"]
category: "Java"
draft: false
lang: zh_CN
---

### **jasypt 加解密** (亲测)

- 引入maven依赖

  ```xml
  <!-- swagger2增强，官方ui太low ， 访问地址： /doc.html  -->
  <!-- 只想换个皮就用1.9.6版本 2.0以上是增强版本  -->
  <dependency>
      <groupId>com.github.xiaoymin</groupId>
      <artifactId>knife4j-spring-boot-starter</artifactId>
      <!-- <version>1.9.6</version>-->
      <version>3.0.2</version>
  </dependency>
  ```

- 配置文件设置盐

  ```yaml
  jasypt:
    encryptor:
      password: salt
  ```

- 添加测试用例

  ```java
  @Autowired
  private StringEncryptor encryptor;

  @Test
  void getPass() {
      String url = encryptor.encrypt("root");
      String username = encryptor.encrypt("root");
      String password = encryptor.encrypt("root");
      System.out.println("url:" + url);
      System.out.println("username:" + username);
      System.out.println("password:" + password);
  }
  ```

- 执行结果

  ```text
  url:ilrFIJcIWHMzDvah77RlYAtmMmhMAPRLygVKHLg807gl6e4ZP7IO7B68hlXdr8Ir
  username:GaQi3DPmmV6wGzvD+rlZY+lXt+ZBDo49vu44wyaDttPdwDZKvfO74rQvWIwbiP3A
  password:3wvbr1LmdsZb79dpwSzgufgzFkh8XyYDNo1stEr8UHYsegKIJlpYgIxZ/5uO5KML
  ```

- 修改配置文件

  ```yaml
  spring:
    datasource:
      url: ENC(ilrFIJcIWHMzDvah77RlYAtmMmhMAPRLygVKHLg807gl6e4ZP7IO7B68hlXdr8Ir)
      username: ENC(GaQi3DPmmV6wGzvD+rlZY+lXt+ZBDo49vu44wyaDttPdwDZKvfO74rQvWIwbiP3A)
      password: ENC(3wvbr1LmdsZb79dpwSzgufgzFkh8XyYDNo1stEr8UHYsegKIJlpYgIxZ/5uO5KML)
  ```

