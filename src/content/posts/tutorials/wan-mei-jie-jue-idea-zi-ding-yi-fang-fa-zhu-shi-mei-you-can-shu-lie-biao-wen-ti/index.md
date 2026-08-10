---
title: "完美解决IDEA自定义方法注释没有参数列表问题"
published: 2021-12-16
description: "只有截图和关键配置"
tags: ["运维"]
category: "Java"
draft: false
lang: zh_CN
---

只有截图和关键配置

![image-20211216153557366](https://oss.tianch.xyz/img/image-20211216153557366.png)

```java
/**
```

![image-20211216153609274](https://oss.tianch.xyz/img/image-20211216153609274.png)

```java
*
* $param$
* @return $return$
* @description TODO 描述
* @author tianch
* @date $date$
*/
```

![image-20211216153726066](https://oss.tianch.xyz/img/image-20211216153726066.png)

```groovy
groovyScript("if(\"${_1}\".length() == 2) {return '';} else {def result='*'; def params=\"${_1}\".replaceAll('[\\\\[|\\\\]|\\\\s]', '').split(',').toList(); for(i = 0; i < params.size(); i++) { if(i==0) result='@param ' + params[i] + ' ' + params[i] + '\\n'; else result+=' * @param ' + params[i] + ' ' + params[i] + ((i < params.size() - 1) ? '\\n' : '')}; return result}", methodParameters())
```

```java
methodReturnType()
```

```java
date("yyyy/MM/dd HH:mm")
```

