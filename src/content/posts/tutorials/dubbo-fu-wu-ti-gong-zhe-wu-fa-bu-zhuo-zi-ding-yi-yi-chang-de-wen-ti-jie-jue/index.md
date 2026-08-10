---
title: "dubbo服务提供者无法捕捉自定义异常的问题解决"
published: 2021-12-16
description: "Dubbo服务调用过程中抛出的自定义异常捕获不到，总是抛出了一个RuntimeException包装了自定义异常，导致全局异常处理器捕捉不到自定义异常。"
tags: ["dubbo"]
category: "Java"
draft: false
lang: zh_CN
---

### 一、问题

Dubbo服务调用过程中抛出的自定义异常捕获不到，总是抛出了一个RuntimeException包装了自定义异常，导致全局异常处理器捕捉不到自定义异常。

经过断点可知:

![image-20211216143614030](https://oss.tianch.xyz/img/image-20211216143614030.png)

自定义异常确实被包装成了RuntimeException异常。

经过断点调试跳转到ExceptionFilter这个类,在`org.apache.dubbo.rpc.filter`下,贴出源码 版本2

7.8

```java
package org.apache.dubbo.rpc.filter;

import org.apache.dubbo.common.constants.CommonConstants;
import org.apache.dubbo.common.extension.Activate;
import org.apache.dubbo.common.logger.Logger;
import org.apache.dubbo.common.logger.LoggerFactory;
import org.apache.dubbo.common.utils.ReflectUtils;
import org.apache.dubbo.common.utils.StringUtils;
import org.apache.dubbo.rpc.Filter;
import org.apache.dubbo.rpc.Invocation;
import org.apache.dubbo.rpc.Invoker;
import org.apache.dubbo.rpc.Result;
import org.apache.dubbo.rpc.RpcContext;
import org.apache.dubbo.rpc.RpcException;
import org.apache.dubbo.rpc.service.GenericService;

import java.lang.reflect.Method;


/**
 * ExceptionInvokerFilter
 * <p>
 * Functions:
 * <ol>
 * <li>unexpected exception will be logged in ERROR level on provider side. Unexpected exception are unchecked
 * exception not declared on the interface</li>
 * <li>Wrap the exception not introduced in API package into RuntimeException. Framework will serialize the outer exception but stringnize its cause in order to avoid of possible serialization problem on client side</li>
 * </ol>
 */
@Activate(group = CommonConstants.PROVIDER)
public class ExceptionFilter implements Filter, Filter.Listener {
    private Logger logger = LoggerFactory.getLogger(ExceptionFilter.class);

    @Override
    public Result invoke(Invoker<?> invoker, Invocation invocation) throws RpcException {
        return invoker.invoke(invocation);
    }

    @Override
    public void onResponse(Result appResponse, Invoker<?> invoker, Invocation invocation) {
        if (appResponse.hasException() && GenericService.class != invoker.getInterface()) {
            try {
                Throwable exception = appResponse.getException();

                // directly throw if it's checked exception
                // 检查是否是RuntimeException或者Exception 我的自定义异常继承自RuntimeException 不满足此条件
                if (!(exception instanceof RuntimeException) && (exception instanceof Exception)) {
                    return;
                }
                // directly throw if the exception appears in the signature
                // 方法上也没有声明我的自定义异常 不满足此条件
                try {
                    Method method = invoker.getInterface().getMethod(invocation.getMethodName(), invocation.getParameterTypes());
                    Class<?>[] exceptionClassses = method.getExceptionTypes();
                    for (Class<?> exceptionClass : exceptionClassses) {
                        if (exception.getClass().equals(exceptionClass)) {
                            return;
                        }
                    }
                } catch (NoSuchMethodException e) {
                    return;
                }

                // for the exception not found in method's signature, print ERROR message in server's log.
                logger.error("Got unchecked and undeclared exception which called by " + RpcContext.getContext().getRemoteHost() + ". service: " + invoker.getInterface().getName() + ", method: " + invocation.getMethodName() + ", exception: " + exception.getClass().getName() + ": " + exception.getMessage(), exception);

                // directly throw if exception class and interface class are in the same jar file.
                // 如果异常类和接口类在同一jar文件中，则直接抛出 接口和异常不在同一个jar包中 不满足
                String serviceFile = ReflectUtils.getCodeBase(invoker.getInterface());
                String exceptionFile = ReflectUtils.getCodeBase(exception.getClass());
                if (serviceFile == null || exceptionFile == null || serviceFile.equals(exceptionFile)) {
                    return;
                }
                // directly throw if it's JDK exception
                // 如果是JDK异常 直接抛出 我的是自定义异常  不满足
                String className = exception.getClass().getName();
                if (className.startsWith("java.") || className.startsWith("javax.")) {
                    return;
                }
                // directly throw if it's dubbo exception
                // 如果是dubbo的异常 直接抛出 我的自定义异常 不满足
                if (exception instanceof RpcException) {
                    return;
                }

                // otherwise, wrap with RuntimeException and throw back to the client
                // 这里就说明了,其它异常会包装成一个RuntimeException并返回给客户端
                appResponse.setException(new RuntimeException(StringUtils.toString(exception)));
            } catch (Throwable e) {
                logger.warn("Fail to ExceptionFilter when called by " + RpcContext.getContext().getRemoteHost() + ". service: " + invoker.getInterface().getName() + ", method: " + invocation.getMethodName() + ", exception: " + e.getClass().getName() + ": " + e.getMessage(), e);
            }
        }
    }

    @Override
    public void onError(Throwable e, Invoker<?> invoker, Invocation invocation) {
        logger.error("Got unchecked and undeclared exception which called by " + RpcContext.getContext().getRemoteHost() + ". service: " + invoker.getInterface().getName() + ", method: " + invocation.getMethodName() + ", exception: " + e.getClass().getName() + ": " + e.getMessage(), e);
    }

    // For test purpose
    public void setLogger(Logger logger) {
        this.logger = logger;
    }
}
```

### 二、解决方案

1. 在方法上声明自定义异常 也就是throws 自定义异常
2. 将异常和接口放到同一个包下
3. 重写一个ExceptionFilter替代dubbo的ExceptionFilter

这里说下方案3 代码就是复制的ExceptionFilter的代码 需要在里面把我们的自定义异常处理一下 顺便把otherwise下面的包装成我们的自定义异常,不让它再包装成RuntimeException

```java
import com.tianch.platform.common.log.exception.PException;
import com.tianch.platform.common.log.exception.enmus.PExceptionEnum;
import lombok.extern.slf4j.Slf4j;
import org.apache.dubbo.common.constants.CommonConstants;
import org.apache.dubbo.common.extension.Activate;
import org.apache.dubbo.common.utils.ReflectUtils;
import org.apache.dubbo.rpc.*;
import org.apache.dubbo.rpc.service.GenericService;

import java.lang.reflect.Method;

@Slf4j
@Activate(group = CommonConstants.PROVIDER)
public class DubboProviderFilter implements Filter, Filter.Listener {

    @Override
    public Result invoke(Invoker<?> invoker, Invocation invocation) throws org.apache.dubbo.rpc.RpcException {
        return invoker.invoke(invocation);
    }

    @Override
    public void onResponse(Result appResponse, Invoker<?> invoker, Invocation invocation) {
        if (appResponse.hasException() && GenericService.class != invoker.getInterface()) {
            try {
                Throwable exception = appResponse.getException();

                // directly throw if it's checked exception
                if (!(exception instanceof RuntimeException) && (exception instanceof Exception)) {
                    return;
                }
                // directly throw if the exception appears in the signature
                try {
                    Method method = invoker.getInterface().getMethod(invocation.getMethodName(), invocation.getParameterTypes());
                    Class<?>[] exceptionClassses = method.getExceptionTypes();
                    for (Class<?> exceptionClass : exceptionClassses) {
                        if (exception.getClass().equals(exceptionClass)) {
                            return;
                        }
                    }
                } catch (NoSuchMethodException e) {
                    return;
                }

                // for the exception not found in method's signature, print ERROR message in server's log.
                log.error("Got unchecked and undeclared exception which called by " + org.apache.dubbo.rpc.RpcContext.getContext().getRemoteHost() + ". service: " + invoker.getInterface().getName() + ", method: " + invocation.getMethodName() + ", exception: " + exception.getClass().getName() + ": " + exception.getMessage(), exception);

                // directly throw if exception class and interface class are in the same jar file.
                String serviceFile = ReflectUtils.getCodeBase(invoker.getInterface());
                String exceptionFile = ReflectUtils.getCodeBase(exception.getClass());
                if (serviceFile == null || exceptionFile == null || serviceFile.equals(exceptionFile)) {
                    return;
                }
                // directly throw if it's JDK exception
                String className = exception.getClass().getName();
                if (className.startsWith("java.") || className.startsWith("javax.")) {
                    return;
                }
                // directly throw if it's dubbo exception
                if (exception instanceof RpcException) {
                    return;
                }

                // 如果是我们的自定义异常
                if (exception instanceof PException) {
                    return;
                }

                 // otherwise, 包装成我们的自定义异常
                String application = invoker.getUrl().getParameter(CommonConstants.APPLICATION_KEY);
                PException pException = new PException(application, PExceptionEnum.SYSTEM_EXCEPTION.getCode(), exception.getMessage());
                appResponse.setException(pException);
            } catch (Throwable e) {
                log.warn("Fail to ExceptionFilter when called by " + org.apache.dubbo.rpc.RpcContext.getContext().getRemoteHost() + ". service: " + invoker.getInterface().getName() + ", method: " + invocation.getMethodName() + ", exception: " + e.getClass().getName() + ": " + e.getMessage(), e);
            }
        }
    }

    @Override
    public void onError(Throwable e, Invoker<?> invoker, Invocation invocation) {
        log.error("Got unchecked and undeclared exception which called by " + RpcContext.getContext().getRemoteHost() + ". service: " + invoker.getInterface().getName() + ", method: " + invocation.getMethodName() + ", exception: " + e.getClass().getName() + ": " + e.getMessage(), e);
    }

}
```

和dubbo一样,利用SPI机制加载我们的异常过滤器

![image-20211216152335306](https://oss.tianch.xyz/img/image-20211216152335306.png)

仿照这个文件写一个把我们自己的异常过滤器声明出来

![image-20211216152515977](https://oss.tianch.xyz/img/image-20211216152515977.png)

在配置里去掉dubbo的异常过滤器并加上我们自己的异常过滤器

![image-20211216152639390](https://oss.tianch.xyz/img/image-20211216152639390.png)

注意`-`是排除

