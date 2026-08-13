---
title: "Java调用JS/TS与JS/TS调用Java完全指南"
published: 2026-08-13
description: "详解Java与JavaScript/TypeScript相互调用的各种方式：Nashorn、GraalJS脚本引擎调用JS函数与对象，TypeScript编译产物加载，JS中通过Java.type调用Java类、Java.extend继承接口，以及Bindings注入Java对象，附完整可运行代码与数据转换、性能注意事项。"
tags: ["Java", "JavaScript", "TypeScript"]
category: "Java"
draft: false
lang: zh_CN
---

在实际项目中，经常需要在 Java 里跑一段 JS/TS 逻辑（比如热更新规则引擎、前端模板、第三方 JS 库），或者在 JS 环境里调用 Java 的能力。本文覆盖两方向的全部主流方案：

- **Java 调用 JS**：Nashorn（JDK 8~14 内置）、GraalJS（JDK 15+ 推荐）；
- **Java 调用 TS**：TypeScript 编译成 JS 后加载执行；
- **JS 调用 Java**：`Java.type` 直接调类、`Java.extend` 实现接口、Bindings 注入对象、GraalVM `node --jvm`。

每部分都给出完整可运行的代码。

> **先澄清一个前提**：TypeScript 没有独立运行时，浏览器和 Node 执行的都是编译后的 JS。所以 **Java 里能直接执行的是 JS，TS 必须先编译成 JS**，本文第四节演示完整链路。

## 一、技术路线总览

| 方案 | 引擎 | 适用 JDK | 说明 |
| --- | --- | --- | --- |
| Nashorn | JDK 内置 | 8 ~ 14 | 开箱即用，JDK 15 起被移除（JEP 372） |
| GraalJS | GraalVM 提供的 JS 引擎 | 15+（也可 8+） | 官方推荐替代，性能更好，支持 ES2023 |
| J2V8 | V8 引擎 Java 绑定 | 8+ | 性能最高，但要引入 Native 库 |
| Rhino | 纯 Java 实现 | 8+ | 老牌引擎，性能一般 |

**选型建议**：JDK 8~14 直接用 Nashorn；JDK 15+ 加一个 GraalJS 依赖即可，接口用法和 Nashorn 几乎一致（都是 JSR-223 `ScriptEngine`），本文示例两种都能跑。

## 二、环境准备

### 1. JDK 8~14：直接可用

Nashorn 内置在 JDK 里，无需任何依赖：

```java
import javax.script.*;

ScriptEngineManager manager = new ScriptEngineManager();
ScriptEngine engine = manager.getEngineByName("nashorn"); // 或 "js" / "JavaScript"
```

### 2. JDK 15+：引入 GraalJS

pom.xml 添加依赖：

```xml
<dependency>
    <groupId>org.graalvm.js</groupId>
    <artifactId>js</artifactId>
    <version>23.0.1</version>
</dependency>
<dependency>
    <groupId>org.graalvm.js</groupId>
    <artifactId>js-scriptengine</artifactId>
    <version>23.0.1</version>
</dependency>
```

引擎名改为 `graal.js`，其余 API 与 Nashorn 一致：

```java
ScriptEngine engine = new ScriptEngineManager().getEngineByName("graal.js");
```

## 三、Java 调用 JS

### 1. 基础：执行一段 JS 并取返回值

```java
public class JsCallDemo {

    public static void main(String[] args) throws Exception {
        ScriptEngine engine = new ScriptEngineManager().getEngineByName("nashorn");

        // 方式一：eval 直接执行表达式
        Object result = engine.eval("1 + 2 * 3");
        System.out.println(result); // 7.0（Nashorn 数字默认是 Double）

        // 方式二：定义变量
        engine.eval("var name = '张三';");
        System.out.println(engine.get("name")); // 张三

        // 方式三：执行复杂逻辑
        Object json = engine.eval(
            "var data = {user: 'admin', level: 3};" +
            "JSON.stringify(data);"
        );
        System.out.println(json); // {"user":"admin","level":3}
    }
}
```

### 2. 调用 JS 函数（invokeFunction）

这是最常用的方式——把 JS 函数当"方法"调用，Java 传参、JS 算完返回结果：

```java
public class JsFunctionDemo {

    public static void main(String[] args) throws Exception {
        ScriptEngine engine = new ScriptEngineManager().getEngineByName("nashorn");

        // 定义 JS 函数（一次编译，可反复调用）
        engine.eval("""
                function add(a, b) {
                    return a + b;
                }
                function sayHello(name) {
                    return 'Hello, ' + name + '!';
                }
                """);

        Invocable invocable = (Invocable) engine;

        // 调用函数，Java 参数自动转成 JS 值
        Object sum = invocable.invokeFunction("add", 10, 20);
        System.out.println(sum); // 30.0

        Object msg = invocable.invokeFunction("sayHello", "world");
        System.out.println(msg); // Hello, world!

        // 调用不存在的函数会抛 NoSuchMethodException
        // invocable.invokeFunction("notExist");
    }
}
```

### 3. 调用 JS 对象的成员方法（invokeMethod）

JS 里定义"类"或对象，Java 调用它的方法：

```java
engine.eval("""
        var calculator = {
            total: 0,
            add: function(n) {
                this.total += n;
                return this.total;
            },
            reset: function() {
                this.total = 0;
                return this.total;
            }
        };
        """);

Invocable invocable = (Invocable) engine;

// invokeMethod(对象引用, 方法名, 参数...)
Object obj = engine.get("calculator");
System.out.println(invocable.invokeMethod(obj, "add", 5));  // 5.0
System.out.println(invocable.invokeMethod(obj, "add", 10)); // 15.0
System.out.println(invocable.invokeMethod(obj, "reset"));   // 0.0
```

### 4. 把 Java 对象传给 JS 调用

用 `engine.put()` 把 Java 对象注入 JS 全局作用域，JS 里就能直接调用它的方法：

```java
// Java 侧的服务类
public class UserService {
    public String getUserName(Long id) {
        return "user_" + id;
    }
    public boolean isVip(Long id) {
        return id != null && id % 2 == 0;
    }
}
```

```java
// 注入并调用
UserService service = new UserService();
engine.put("userService", service);

engine.eval("""
        function checkUser(id) {
            var name = userService.getUserName(id);   // 调用 Java 方法
            var vip  = userService.isVip(id);
            return name + (vip ? ' [VIP]' : '');
        }
        """);

Object result = ((Invocable) engine).invokeFunction("checkUser", 10086L);
System.out.println(result); // user_10086 [VIP]
```

### 5. 传递复杂数据：统一用 JSON

Java 对象和 JS 对象之间的"原生互操作"容易踩坑（字段命名、类型转换差异）。**最稳妥的做法是统一走 JSON 字符串**：

```java
Object json = engine.eval("JSON.stringify({id: 1, name: 'iphone', price: 6999.0});");

// 用 Jackson 解析成 Java 对象
Product product = new ObjectMapper().readValue(json.toString(), Product.class);
System.out.println(product.getName()); // iphone
```

反过来，Java 传 JSON 字符串给 JS：

```java
String json = "{\"id\":2,\"name\":\"macbook\"}";
Object result = engine.eval(
    "var p = JSON.parse(" + "'" + json + "'" + ");" +
    "p.name + ' 价格 ' + (p.price || '未知');"
);
System.out.println(result);
```

> 注意：JS 的 `parseInt`、数字运算结果通常是 `Double`，拿回来要按 `Number` 处理，再 `.intValue()` / `.longValue()`，直接强转 `int` 会 `ClassCastException`。

## 四、Java 调用 TypeScript

TS 不能直接被 JVM 执行，标准做法是**用 tsc 编译成 JS，再把 JS 文件交给 Java 执行**。

### 1. 编写 TS 源码

用**命名空间**方式声明，编译后挂到全局对象上，避免 CommonJS 的 `require/module` 依赖（脚本引擎环境里没有这些）：

```typescript
// math-utils.ts
namespace MathUtils {
    export function add(a: number, b: number): number {
        return a + b;
    }

    export function multiply(a: number, b: number): number {
        return a * b;
    }

    export function formatPrice(price: number): string {
        return "¥" + price.toFixed(2);
    }
}
```

### 2. 编译成 JS

```shell
# 安装 TypeScript
npm install -g typescript

# 编译（输出到 js 目录）
tsc math-utils.ts --outFile js/math-utils.js --target es5
```

编译产物大致如下，全局对象 `MathUtils` 已经生成：

```javascript
var MathUtils;
(function (MathUtils) {
    function add(a, b) { return a + b; }
    MathUtils.add = add;
    function multiply(a, b) { return a * b; }
    MathUtils.multiply = multiply;
    function formatPrice(price) { return "¥" + price.toFixed(2); }
    MathUtils.formatPrice = formatPrice;
})(MathUtils || (MathUtils = {}));
```

### 3. Java 加载并调用

```java
public class TsCallDemo {

    public static void main(String[] args) throws Exception {
        ScriptEngine engine = new ScriptEngineManager().getEngineByName("nashorn");

        // 读取编译后的 JS 文件并执行（注册全局 MathUtils）
        String script = Files.readString(Paths.get("js/math-utils.js"));
        engine.eval(script);

        // 调用 TS 编译出来的方法（用 eval 访问全局对象的方法）
        Object sum = engine.eval("MathUtils.add(3, 4)");
        System.out.println(sum); // 7.0

        Object price = engine.eval("MathUtils.formatPrice(1999.5)");
        System.out.println(price); // ¥1999.50
    }
}
```

**要点**：

- `tsconfig` 里建议 `--module` 使用非 CommonJS 的方式（或 `--outFile` 打包成单文件 IIFE），确保产物**不依赖 `require/module`**；
- 如果 TS 是 `export function` 的模块形式，可用打包器（esbuild / webpack）打成单文件后加载；
- 编译产物可以**预先打进 jar 的资源目录**，Java 端 `getResourceAsStream` 读取。

## 五、JS 调用 Java

### 1. Nashorn：`Java.type` 直接调用 Java 类

Nashorn 里通过全局函数 `Java.type()` 拿到 Java 类，调用静态方法或 `new` 实例：

```javascript
// JS 脚本内容
var System = Java.type("java.lang.System");
System.out.println("hello from JS!");

var Math = Java.type("java.lang.Math");
var result = Math.max(3, 9);
System.out.println("max = " + result);

// new 一个 Java 对象
var ArrayList = Java.type("java.util.ArrayList");
var list = new ArrayList();
list.add("Java");
list.add("JavaScript");
System.out.println("size = " + list.size());      // 2
System.out.println("item = " + list.get(0));      // Java
```

Java 端只需把脚本喂给引擎：

```java
String script = """
        var System = Java.type("java.lang.System");
        var Math = Java.type("java.lang.Math");
        System.out.println("from JS: " + Math.pow(2, 10));

        var list = new (Java.type("java.util.ArrayList"))();
        list.add("a");
        System.out.println(list.size());
        """;
engine.eval(script);
```

### 2. `Java.extend`：在 JS 里实现 Java 接口/继承类

最经典的场景是**用 JS 实现 Java 接口**，把 JS 函数变成回调传给 Java：

```javascript
// 定义一个 Java 接口：public interface Calculator { int calc(int x, int y); }
var Calculator = Java.type("com.example.Calculator");

// 用 JS 对象实现接口
var addCalculator = new Calculator({
    calc: function(x, y) {
        return x + y;
    }
});

// 使用这个"JS实现的Java对象"
print(addCalculator.calc(3, 4)); // 7
```

如果接口方法较多，用 `Java.extend` 显式指定：

```javascript
var Runnable = Java.type("java.lang.Runnable");
var MyTask = Java.extend(Runnable, {
    run: function() {
        print("task executed!");
    }
});
var task = new MyTask();

var Thread = Java.type("java.lang.Thread");
new Thread(task).start();   // JS 实现的 Runnable 丢给 Java 线程池执行
```

### 3. Java 注入对象，JS 反向调用（双向互通）

把 Java 对象 `put` 进引擎，JS 里既能"调 Java"，还能把 JS 函数**传回给 Java 调用**：

```java
// Java 侧：定义函数式接口 + 注入服务对象
@FunctionalInterface
public interface GreetHandler {
    String greet(String name);
}
```

```java
engine.put("greetService", (GreetHandler) name -> "Hello " + name); // 注入 Java lambda

engine.eval("""
        // JS 里调用注入的 Java 服务
        var msg = greetService.greet("JS");
        print(msg);                     // Hello JS

        // 再把 JS 函数通过全局变量暴露给 Java
        var jsHandler = function(n) { return "From JS: " + n; };
        engine.put("jsCallback", jsHandler);   // Java 可以拿到这个函数
        """);
```

> 小坑：Nashorn 里直接执行 `engine.put` 不生效时，可以改成 `engine.eval("jsCallback = ...")` 并配合 Java 侧 `engine.get("jsCallback")` 取回。实际生产更多用 `Invocable.getInterface` 把 JS 函数适配成 Java 接口。

### 4. 用 `getInterface` 把 JS 函数转成 Java 接口

这是最优雅的方式——**JS 函数变身 Java 接口实现**，Java 业务代码完全无感：

```java
engine.eval("function add(a, b) { return a + b; }");

Invocable invocable = (Invocable) engine;
// 把 JS 函数适配成 Java 接口 Calculator
Calculator calc = invocable.getInterface(Calculator.class);

System.out.println(calc.calc(2, 3)); // 5
```

### 5. GraalVM：`node --jvm` 里 JS 直接调 Java

如果在 **Node.js 环境**（而非 ScriptEngine）里想让 JS 调 Java，用 GraalVM 的 Node 运行时，通过 `--jvm` 参数加载 Java：

```shell
# 用 GraalVM 的 node 运行（带 JVM）
node --jvm --polyglot app.js
```

```javascript
// app.js
const ArrayList = Java.type("java.util.ArrayList");
const list = new ArrayList();
list.add("Hello");
list.add("GraalVM");

const System = Java.type("java.lang.System");
System.out.println("list size = " + list.size());
```

## 六、数据转换与常见问题

### 1. JS ↔ Java 类型对照

| Java | JavaScript (Nashorn) | 说明 |
| --- | --- | --- |
| `int`/`double`/`long` | `Number` | 注意精度：`long` 超过 2^53 会丢精度 |
| `String` | `String` | 直接对应 |
| `boolean` | `Boolean` | 直接对应 |
| `null` | `null` / `undefined` | 二者不同，判断时要兼容 |
| Java `List` | 数组式访问（`list[0]`） | 不能用 `list.length`，用 `list.size()` |
| Java `Map` | 属性式访问（`map.get('k')`） | 或用 `engine.eval` 转成 JS 对象 |
| Java 对象 | 包装的宿主对象 | 方法直接可调，字段走 getter |

### 2. 性能注意事项

- **一次编译，多次调用**：`eval` 每次都要解析脚本，性能很差。把脚本一次性 `eval`，之后用 `Invocable.invokeFunction` 反复调用；
- **ScriptEngine 非线程安全**：同一个 `ScriptEngine` 实例不能多线程并发用，要线程安全就用 `ThreadLocal` 各持一份，或加锁（会有性能损失）；
- **高频调用用 GraalJS / J2V8**：Nashorn 是解释执行，性能一般；GraalJS 有 JIT 编译，适合规则引擎等高频场景；
- **大数据量交互走 JSON**：JS 对象与 Java 对象互转用 `JSON.stringify` + Jackson，避免原生互操作的隐蔽问题。

### 3. Nashorn 被移除怎么办

- JDK 15 起 Nashorn 被移除（JEP 372），`getEngineByName("nashorn")` 会返回 `null`；
- 迁移到 GraalJS：**依赖换成 GraalJS 两个 jar，引擎名换成 `graal.js`，其余 `ScriptEngine`/`Invocable` API 不变**；
- 老项目不想动代码：把 JDK 锁在 8~14，或继续用第三方 Nashorn 独立版（`org.openjdk.nashorn:nashorn-core`）。

## 七、适用场景对比

| 场景 | 推荐方案 |
| --- | --- |
| 规则/表达式引擎动态更新（不重启改规则） | Nashorn / GraalJS + `invokeFunction` |
| 执行前端模板或第三方 JS 库 | GraalJS 加载编译产物 |
| Java 里跑 TS 写的算法/工具 | tsc 编译 → Java 加载执行 |
| 用 JS 快速实现 Java 接口（测试替身、回调） | `getInterface` / `Java.extend` |
| Node 环境下复用 Java 生态能力 | GraalVM `node --jvm` |
| 极高并发且对性能敏感 | J2V8（V8 引擎）或 GraalJS 上下文池 |

## 八、总结

- **Java 调 JS**：`ScriptEngine.eval` 执行脚本 + `Invocable.invokeFunction/invokeMethod` 调函数，`engine.put` 注入 Java 对象，复杂数据统一走 JSON；
- **Java 调 TS**：TS 编译成 JS（注意产物不要依赖 `require/module`），Java 读取文件 `eval` 后调用；
- **JS 调 Java**：`Java.type` 拿类、`new` 实例，`Java.extend` 实现接口，`getInterface` 把 JS 函数转 Java 接口；
- **性能与安全**：一次编译多次调用、引擎非线程安全按需隔离、别在服务器上 eval 不可信的脚本（有安全风险）；
- **JDK 版本**：8~14 用 Nashorn，15+ 用 GraalJS，代码几乎不用改。

一句话：**理解 `ScriptEngine` + `Invocable` 这对核心 API，再把 JSON 当"通用语言"，Java 和 JS/TS 之间就能自由互通了。**
