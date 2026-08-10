---
title: "dubbo微服务之间的隐式数据传递"
published: 2022-02-20
description: "在做全链路压测插件时,如何让流量标识在dubbo远程RPC调用时进行传递是一个需要解决的问题,就可以用dubbo的Attachment做隐式传递,服务A） -- （服务B -- ）（服务C）等等."
tags: ["dubbo"]
category: "Java"
draft: false
lang: zh_CN
---

### 利用dubbo的Attachment做隐式传递

在做全链路压测插件时,如何让流量标识在dubbo远程RPC调用时进行传递是一个需要解决的问题,就可以用dubbo的Attachment做隐式传递,服务A） --> （服务B --> ）（服务C）等等.

- 上下文类

  ```java
  public class WormholeContextHolder {

      private static final InheritableThreadLocal<WormholeContext> wormholeContextThreadLocal = new InheritableThreadLocal<>();

      /**
       * 上下文流量标识
       */
      public static final String WORMHOLE_REQUEST_MARK = "X-Wormhole-Header-Request";

      /**
       * @return com.hoolai.wormhole.core.context.WormholeContext
       * @description 获取上下文
       */
      public static WormholeContext getContext() {
          return wormholeContextThreadLocal.get();
      }

      /**
       * @param key key
       * @return java.lang.String
       * @description 获取上下文中的属性
       */
      public static String getProperty(String key) {
          WormholeContext wormholeContext = getContext();
          if (wormholeContext != null) {
              return wormholeContext.toString();
          }
          return null;
      }

      /**
       * @param context context
       * @description 设置上下文
       */
      public static void setContext(WormholeContext context) {
          wormholeContextThreadLocal.set(context);
      }

      public static void setContext(String contextStr) {
          if (StringUtils.isNotEmpty(contextStr)) {
              setContext(new WormholeContext(contextStr));
          }
      }

      /**
       * @description 将上下文进行失效
       */
      public static void invalidContext() {
          wormholeContextThreadLocal.remove();
      }

  }
  ```

- 消费者

  ```java
  import org.apache.dubbo.common.constants.CommonConstants;
  import org.apache.dubbo.common.extension.Activate;
  import org.apache.dubbo.rpc.*;


  @Activate(group = CommonConstants.CONSUMER)
  public class ParamConsumerFilter implements Filter {

      @Override
      public Result invoke(Invoker<?> invoker, Invocation invocation) throws RpcException {
          WormholeContext wormholeContext = WormholeContextHolder.getContext();
          if (wormholeContext != null) {
              RpcContext.getContext().setAttachment(WormholeContextHolder.WORMHOLE_REQUEST_MARK, wormholeContext.getWormholeValue());
          }
          return invoker.invoke(invocation);
      }
  }
  ```

- 生产者

  ```java
  import org.apache.dubbo.common.constants.CommonConstants;
  import org.apache.dubbo.common.extension.Activate;
  import org.apache.dubbo.rpc.*;


  @Activate(group = CommonConstants.PROVIDER)
  public class ParamProviderFilter implements Filter {

      @Override
      public Result invoke(Invoker<?> invoker, Invocation invocation) throws RpcException {
          String wormholeContext = RpcContext.getContext().getAttachment(WormholeContextHolder.WORMHOLE_REQUEST_MARK);
          if (StringUtils.isNotBlank(wormholeContext)) {
              RpcContext.getContext().setAttachment(WormholeContextHolder.WORMHOLE_REQUEST_MARK, wormholeContext);
              WormholeContextHolder.setContext(wormholeContext);
          }
          return invoker.invoke(invocation);
      }
  }
  ```

- 过滤器的SPI配置

  在资源文件夹下创建一个3层的文件夹:META-INF -- dubbo -- internal ,注意不要一块写中间加.分隔的形式,这样创建的是`META-INF.dubbo.internal`,变成了一个文件夹.

  文件夹下创建一个名为`org.apache.dubbo.rpc.Filter`的文件.配置这一块可以参考dubbo源码的过滤器部分

  文件内容如下,名称=类名

  ```java
  paramConsumerFilter=com.tianch.wormhole.component.dubbo.ParamConsumerFilter
  paramProviderFilter=com.tianch.wormhole.component.dubbo.ParamProviderFilter
  ```

