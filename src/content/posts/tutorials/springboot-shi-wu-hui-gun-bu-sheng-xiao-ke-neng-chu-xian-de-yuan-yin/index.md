---
title: "Springboot 事务回滚不生效可能出现的原因"
published: 2021-07-01
description: "注意：添加@Transactional的方法必须是public"
tags: ["Spring"]
category: "Java"
draft: false
lang: zh_CN
---

1.数据库是否为InnoDB引擎：InnoDB支持事务 MyISAM不支持事务

2.配置文件中是否开启

```yaml
transaction:
  rollback-on-commit-failure: true
```

3.是否在启动类中加入注解（此项可忽略，spring boot 默认开启了事务）

```java
1.点进去 @SpringBootApplication
2.再点进去 @EnableAutoConfiguration
3.可以看到类上的注解 有一个 @Import(AutoConfigurationImportSelector.class) 自动装配的选择器
4.进入AutoConfigurationImportSelector类中 可以看到有个getAutoConfigurationEntry()方法
   AutoConfigurationEntry autoConfigurationEntry = getAutoConfigurationEntry(annotationMetadata);
5.方法中又调用了 getCandidateConfigurations()方法
6.在getCandidateConfigurations()方法中可以很清楚的看到有一个断言
    Assert.notEmpty(configurations, "No auto configuration classes found in META-INF/spring.factories. If you "
				+ "are using a custom packaging, make sure that file is correct.");
重点就在于 META-INF/spring.factories 文件
7.进入到jar包中找到该文件 大概130行
    org.springframework.boot.autoconfigure.transaction.TransactionAutoConfiguration
8.进入TransactionAutoConfiguration类中可以看到一下源码 有这个一个注解 @EnableTransactionManagement



@Configuration(proxyBeanMethods = false)
@ConditionalOnBean(TransactionManager.class)
@ConditionalOnMissingBean(AbstractTransactionManagementConfiguration.class)
public static class EnableTransactionManagementConfiguration {
	@Configuration(proxyBeanMethods = false)
	@EnableTransactionManagement(proxyTargetClass = false)
	@ConditionalOnProperty(prefix = "spring.aop", name = "proxy-target-class", havingValue = "false",
			matchIfMissing = false)
	public static class JdkDynamicAutoProxyConfiguration {
	}
	@Configuration(proxyBeanMethods = false)
	@EnableTransactionManagement(proxyTargetClass = true)
	@ConditionalOnProperty(prefix = "spring.aop", name = "proxy-target-class", havingValue = "true",
			matchIfMissing = true)
	public static class CglibAutoProxyConfiguration {
	}
}

```

4.@Transactional注解位置：

```java
@Transactional注解必须和抛出异常的位置在一起

在Service中加入的事务注解，手动抛出异常时要在Service中抛出，才能看到效果

如果Controller中，调用两个不同Service的方法并开启了事务回滚，要想事务生效，则需要在Controller也加入@Transactional注解
```

5.@Transactional注解默认只能拦截RuntimeException和Error，如果自定义的Exception，需要设置rollbackFor 属性值，如下。也可以让自定义异常继承自RuntimeException。

```java
@Transactional(rollbackFor = Exception.class)
```

6.使用了try，catch捕获并处理了异常

```java
事务回滚的原理就是捕获异常然后回滚，这个时候异常被干掉了，事务管理觉察不到了
在使用@Transactional标注的方法中不要手动捕获异常，可以直接统一抛出异常，交给全局异常处理器处理
```

**注意：添加@Transactional的方法必须是public**

