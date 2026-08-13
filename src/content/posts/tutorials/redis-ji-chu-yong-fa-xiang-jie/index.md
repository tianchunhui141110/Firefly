---
title: "Redis基础用法详解：数据类型、常用命令与Spring Boot实战"
published: 2026-08-13
description: "从零详解Redis五大基础类型(String/Hash/List/Set/ZSet)与扩展类型(GEO/HyperLogLog/Bitmap/Stream)的概念、常用命令和典型场景，并结合Spring Boot演示缓存、分布式锁、排行榜、附近的人、UV统计、签到、延时队列等实战用法，附完整可运行的Java代码。"
tags: ["Redis", "Spring Boot", "Java"]
category: "中间件"
draft: false
lang: zh_CN
---

Redis 是一个高性能的 **key-value 内存数据库**，因为读写极快（单线程 10w+ QPS）、支持丰富的数据结构、原生支持过期时间和分布式能力，几乎成了后端系统缓存层的事实标准。

本篇文章不讲深奥的原理，聚焦**怎么用**：先讲五大基础类型（String/Hash/List/Set/ZSet），再讲 GEO、HyperLogLog、Bitmap、Stream 等扩展类型，每个类型都配上命令和典型场景，最后用 Spring Boot 把最常见的实战用法（缓存、分布式锁、排行榜、附近的人、UV 统计、签到、延时队列等）完整写一遍。

## 一、安装与启动

生产环境一般用 Docker 安装，本地快速体验可以这样：

```shell
# 拉取镜像并启动
docker run -d -p 6379:6379 --name redis --restart always redis

# 进入容器操作 redis-cli
docker exec -it redis redis-cli

# 如果设置了密码
docker exec -it redis redis-cli -a 你的密码
```

启动后 `redis-cli` 进入交互命令行：

```shell
127.0.0.1:6379> ping
PONG

127.0.0.1:6379> set hello world
OK
127.0.0.1:6379> get hello
"world"
```

Redis 常用命令分组记忆：`key` 相关（`keys`/`exists`/`expire`/`ttl`/`del`）、`string` 相关（`set`/`get`/`incr`/`setnx`）、`hash` 相关（`hset`/`hget`/`hgetall`）、`list` 相关（`lpush`/`rpush`/`lpop`/`rpop`）、`set` 相关（`sadd`/`sismember`/`scard`）、`zset` 相关（`zadd`/`zrange`/`zrevrange`）。

## 二、五大基础数据类型

Redis 的 value 有五种基础类型，选择正确的类型往往是设计好缓存的第一步。

| 类型 | 数据结构 | 典型场景 |
| --- | --- | --- |
| String | 字符串/数字 | 缓存对象、计数器、分布式锁 |
| Hash | 字段-值映射 | 对象属性存储、购物车 |
| List | 双向链表 | 消息队列、最新列表 |
| Set | 无序集合（去重） | 去重、共同好友、抽奖 |
| ZSet | 有序集合（带分数） | 排行榜、延时任务 |

### 1. String 字符串

String 是最常用的类型，value 最大 512MB，除了存字符串，还可以存**数字**（支持原子自增），存对象时一般用 JSON 序列化。

**常用命令：**

```shell
127.0.0.1:6379> set user:1 "{\"name\":\"张三\",\"age\":25}"
OK
127.0.0.1:6379> get user:1
"{\"name\":\"张三\",\"age\":25}"

# 原子自增自减（做计数器）
127.0.0.1:6379> incr view:article:1001
(integer) 1
127.0.0.1:6379> incrby view:article:1001 10
(integer) 11
127.0.0.1:6379> decr view:article:1001
(integer) 10

# setnx：不存在才写入（分布式锁核心命令）
127.0.0.1:6379> setnx lock:order:1001 1
(integer) 1
127.0.0.1:6379> setnx lock:order:1001 2   # 第二次失败，说明锁已存在
(integer) 0

# 带过期时间设置（缓存核心）
127.0.0.1:6379> set session:abc123 value ex 300   # 5分钟后过期
OK
127.0.0.1:6379> ttl session:abc123
(integer) 300

# setex：set + expire 一步到位
127.0.0.1:6379> setex code:13800000000 60 123456
OK
```

**典型场景：**

- 缓存字符串 / JSON 对象；
- 计数器（页面浏览量、接口限流）；
- 分布式锁（`setnx` + `expire`）。

### 2. Hash 哈希

Hash 是**字段-值**的映射表，适合存一个"对象"，比如用户信息 `user:1 → { name, age, email }`。相比把整个对象序列化成一个 String，Hash 可以**单独读写某个字段**，省流量且局部更新方便。

**常用命令：**

```shell
127.0.0.1:6379> hset user:1 name 张三 age 25 email zhangsan@qq.com
(integer) 3
127.0.0.1:6379> hget user:1 name
"张三"
127.0.0.1:6379> hgetall user:1
1) "name"
2) "张三"
3) "age"
4) "25"

# 只取所有字段或所有值
127.0.0.1:6379> hkeys user:1
1) "name"
2) "age"
3) "email"
127.0.0.1:6379> hvals user:1
1) "张三"
2) "25"
3) "zhangsan@qq.com"

# 原子自增某个字段（可做 hash 内计数器）
127.0.0.1:6379> hincrby user:1 score 10
(integer) 10

# 判断字段是否存在 / 删除字段
127.0.0.1:6379> hexists user:1 name
(integer) 1
127.0.0.1:6379> hdel user:1 email
(integer) 1
```

**典型场景：**

- 用户/商品等对象数据缓存；
- 购物车：`cart:{userId} → { 商品id: 数量 }`。

### 3. List 列表

List 是**双向链表**，支持头尾压入/弹出，天然适合做**队列**和**栈**，也适合做"最新列表"。

**常用命令：**

```shell
# 头插 / 尾插
127.0.0.1:6379> lpush msg:queue m1 m2 m3
(integer) 3
127.0.0.1:6379> rpush msg:queue m4
(integer) 4

# 取范围内元素（0 到 -1 表示全部，从左到右）
127.0.0.1:6379> lrange msg:queue 0 -1
1) "m3"
2) "m2"
3) "m1"
4) "m4"

# 左弹 / 右弹（出队）
127.0.0.1:6379> lpop msg:queue
"m3"
127.0.0.1:6379> rpop msg:queue
"m4"

# 阻塞弹出：队列为空时最多等 10 秒
127.0.0.1:6379> brpop msg:queue 10
1) "msg:queue"
2) "m2"

# 只保留前 100 条（做"最近列表"很常用）
127.0.0.1:6379> ltrim msg:queue 0 99
OK

# 获取长度
127.0.0.1:6379> llen msg:queue
(integer) 1
```

**典型场景：**

- 简单消息队列（`lpush` + `brpop` 阻塞消费）；
- 最新列表：如最新发布的 100 篇文章，用 `lpush` + `ltrim` 维护；
- 待办任务列表。

### 4. Set 集合

Set 是**无序去重**的集合，底层哈希表，支持交集、并集、差集运算，是做**去重**和**关系运算**的神器。

**常用命令：**

```shell
# 添加元素（重复添加无效）
127.0.0.1:6379> sadd tags:article:1001 redis java spring
(integer) 3
127.0.0.1:6379> sadd tags:article:1001 redis
(integer) 0        # 已存在，返回 0

# 判断是否存在（O(1)）
127.0.0.1:6379> sismember tags:article:1001 java
(integer) 1

# 元素数量
127.0.0.1:6379> scard tags:article:1001
(integer) 3

# 交集 / 并集 / 差集（共同好友、推荐等场景）
127.0.0.1:6379> sadd user:1:follow a b c
(integer) 3
127.0.0.1:6379> sadd user:2:follow b c d
(integer) 3
127.0.0.1:6379> sinter user:1:follow user:2:follow   # 共同关注
1) "b"
2) "c"
127.0.0.1:6379> sunion user:1:follow user:2:follow  # 并集
127.0.0.1:6379> sdiff user:1:follow user:2:follow   # 我关注了但他没关注

# 随机弹出一个元素（抽奖场景）
127.0.0.1:6379> spop lottery:users
"user_1024"
```

**典型场景：**

- 点赞/收藏/关注去重（`sismember` 判断是否已点）；
- 共同好友/你可能感兴趣（交集/差集）；
- 抽奖（`spop` / `srandmember`）。

### 5. ZSet 有序集合

ZSet 在 Set 的基础上给每个元素关联一个 **score（分数）**，按分数排序，是**排行榜**的标准实现。

**常用命令：**

```shell
# 添加带分数的元素
127.0.0.1:6379> zadd rank:game:1001 100 user_a 80 user_b 95 user_c
(integer) 3

# 按分数从低到高 / 从高到低取前 10 名
127.0.0.1:6379> zrange rank:game:1001 0 -1
1) "user_b"
2) "user_c"
3) "user_a"
127.0.0.1:6379> zrevrange rank:game:1001 0 -1 withscores
1) "user_a"
2) "100"
3) "user_c"
4) "95"
5) "user_b"
6) "80"

# 给某个元素加分（原子更新）
127.0.0.1:6379> zincrby rank:game:1001 5 user_b
"85"

# 查询某个元素的排名（从 0 开始）
127.0.0.1:6379> zrevrank rank:game:1001 user_b
(integer) 2

# 查询某个元素的分数
127.0.0.1:6379> zscore rank:game:1001 user_a
"100"

# 按分数区间查询（如分数在 90-100 之间）
127.0.0.1:6379> zrangebyscore rank:game:1001 90 100
1) "user_c"
2) "user_a"

# 元素总数
127.0.0.1:6379> zcard rank:game:1001
(integer) 3
```

**典型场景：**

- 排行榜（游戏分数、热销榜、搜索热榜）；
- 延时队列（score 存执行时间戳）；
- 范围查询（按价格/时间排序的数据）。

## 三、扩展数据类型（GEO / HyperLogLog / Bitmap / Stream）

除了五大基础类型，Redis 还提供了一批功能强大的扩展类型，其中 **GEO** 专门处理地理位置，非常适合"附近的人"、打车、外卖配送这类 LBS 场景。

| 类型 | 底层 | 典型场景 |
| --- | --- | --- |
| GEO | ZSet（score 为经纬度编码） | 附近的人、打车派单、地图服务 |
| HyperLogLog | 基数统计 | 页面 UV、独立访客去重统计 |
| Bitmap | String 的位操作 | 签到、在线状态、布尔标记 |
| Stream | 消息流 | 生产级轻量消息队列 |

### 1. GEO 地理位置

GEO 底层就是 ZSet，Redis 把经纬度编码成 score 存储，天然支持**两点距离**、**按距离排序查附近**等计算。3.2 版本加入，是 LBS 类应用的标准方案。

**常用命令：**

```shell
# 添加坐标：geoadd key 经度 纬度 member
127.0.0.1:6379> geoadd city:drivers 116.397128 39.916527 driver_1
(integer) 1
127.0.0.1:6379> geoadd city:drivers 121.473701 31.230416 driver_2 113.264385 23.129112 driver_3
(integer) 2

# 获取某个成员的坐标
127.0.0.1:6379> geopos city:drivers driver_1
1) 1) "116.39712756872177124"
   2) "39.91652650017402259"

# 计算两个成员之间的直线距离（单位可选 m/km/mi/ft）
127.0.0.1:6379> geodist city:drivers driver_1 driver_2 km
"1067.4526"

# 查找附近的成员：以(经度 纬度)为中心，半径 50km 内的成员，按距离从近到远
127.0.0.1:6379> georadius city:drivers 116.397128 39.916527 50 km withdist withcoord
1) 1) "driver_1"
   2) "0.0000"
   3) 1) "116.39712756872177124"
      2) "39.91652650017402259"

# 以某个已存在的成员为中心查找附近（如找 driver_1 周围 1000km 的司机）
127.0.0.1:6379> georadiusbymember city:drivers driver_1 1000 km
1) "driver_1"
2) "driver_2"
```

**典型场景：**

- 附近的人 / 附近的门店 / 附近的车；
- 打车软件的司机派单；
- 外卖配送距离计算。

### 2. HyperLogLog 基数统计

HyperLogLog 用来统计**不重复元素的个数**（基数），特点是**占用内存极小**（无论存多少元素，内存约 12KB），误差约 0.81%，适合海量数据的 UV 统计——精确统计几亿条去重数的代价太大，而 UV 统计恰好允许少量误差。

**常用命令：**

```shell
# 添加元素：pfadd key element [element...]
127.0.0.1:6379> pfadd uv:page:home user_1 user_2 user_3
(integer) 1
127.0.0.1:6379> pfadd uv:page:home user_2 user_4
(integer) 1

# 统计基数（不重复数量）
127.0.0.1:6379> pfcount uv:page:home
(integer) 4

# 合并多个 key 再统计（如统计一周的独立访客）
127.0.0.1:6379> pfadd uv:page:home:day1 user_1 user_2
127.0.0.1:6379> pfadd uv:page:home:day2 user_2 user_5
127.0.0.1:6379> pfmerge uv:page:home:week uv:page:home:day1 uv:page:home:day2
OK
127.0.0.1:6379> pfcount uv:page:home:week
(integer) 3
```

**典型场景：**

- 页面 UV、独立访客数统计；
- 注册用户去重计数；
- 活动参与人数统计。

### 3. Bitmap 位图

Bitmap 本质是 String 的**位数组**，用每一位（0/1）表示一个状态，**极其省内存**（1 亿个用户只需约 12MB）。经典套路是「**偏移量 = 用户 id / 日期序号**」。

**常用命令：**

```shell
# 设置某一位：setbit key offset value
# 例：user_id=1001 的用户今天签到 → 偏移量直接用用户 id
127.0.0.1:6379> setbit sign:20260813 1001 1
(integer) 0
127.0.0.1:6379> setbit sign:20260813 1002 1
(integer) 0

# 获取某一位的值
127.0.0.1:6379> getbit sign:20260813 1001
(integer) 1
127.0.0.1:6379> getbit sign:20260813 1003
(integer) 0

# 统计值为 1 的位数（今天有多少人签到）
127.0.0.1:6379> bitcount sign:20260813
(integer) 2

# 位运算：连续签到 N 天，把多天 bitmap 做 AND 运算
127.0.0.1:6379> bitop and sign:2days sign:20260812 sign:20260813
(integer) 126
```

**典型场景：**

- 用户签到、连续签到统计；
- 用户在线状态（上线置 1，下线置 0）；
- 大量布尔型标记（是否推送、是否已读）。

### 4. Stream 消息流

Stream 是 Redis 5.0 推出的**专业消息队列**，弥补了 Pub/Sub 不持久化、List 无法消费者分组的缺陷，支持**消息持久化、消费组、ACK 确认**，生产可用性比 Pub/Sub 高一个档次。

**常用命令：**

```shell
# 追加消息：xadd key * field value
127.0.0.1:6379> xadd order:stream * orderId 1001 status PAID
"1691917459096-0"          # 返回消息 ID

# 读取消息：从头开始读
127.0.0.1:6379> xread count 10 streams order:stream 0

# 创建消费组，从头消费
127.0.0.1:6379> xgroup create order:stream group_order 0
OK

# 消费组读消息（组内每个消费者互不重复地消费）
127.0.0.1:6379> xreadgroup group group_order consumer_1 count 1 streams order:stream >

# 消息处理完成后确认（ACK）
127.0.0.1:6379> xack order:stream group_order 1691917459096-0
(integer) 1

# 查看待处理消息（未 ACK 的）
127.0.0.1:6379> xpending order:stream group_order
```

**典型场景：**

- 生产级的轻量消息队列（订单、日志、通知）；
- 需要**消费者分组**（多个消费者并行消费不同消息）的场景；
- 需要**消息确认**（ACK）保证不丢消息的场景。

## 四、过期时间与持久化

### 1. 过期时间

Redis 的 key 可以设置过期时间，到期自动删除，这是缓存系统的根基：

```shell
# 设置 60 秒后过期
127.0.0.1:6379> expire user:1 60
(integer) 1
# 查看剩余时间，-1 表示永不过期，-2 表示 key 不存在
127.0.0.1:6379> ttl user:1
(integer) 59
# 取消过期
127.0.0.1:6379> persist user:1
(integer) 1
```

> 注意：5 种类型中只有 key 级过期，没有 field/元素级过期。想让 Hash 的某个字段单独过期，要么单独建 key，要么在业务里判断。

### 2. 持久化（RDB / AOF）

Redis 默认在内存中运行，重启数据会丢。要持久化有两个机制：

| 机制 | 原理 | 优点 | 缺点 |
| --- | --- | --- | --- |
| RDB | 定期把内存快照写入磁盘文件 | 文件小、恢复快 | 两次快照间的数据可能丢失 |
| AOF | 记录每一条写命令，追加到日志文件 | 数据丢失少 | 文件大、恢复慢 |

```shell
# 配置文件 redis.conf 示例
# RDB：每 60 秒内有 10000 次写操作就触发快照
save 60 10000
# AOF：开启
appendonly yes
# AOF 刷盘策略 everysec（每 1 秒），性能和数据安全折中
appendfsync everysec
```

生产建议：**AOF + RDB 同时开启**，RDB 做快速恢复，AOF 兜底防丢数据。

## 五、Spring Boot 集成 Redis

### 1. 引入依赖

```xml
<!-- Spring Boot 3.x 用 spring-boot-starter-data-redis -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>

<!-- 可选：连接池 -->
<dependency>
    <groupId>org.apache.commons</groupId>
    <artifactId>commons-pool2</artifactId>
</dependency>
```

### 2. 配置连接

```yaml
# application.yml
spring:
  data:
    redis:
      host: 127.0.0.1
      port: 6379
      password: 你的密码      # 无密码可去掉
      database: 0
      timeout: 3000ms
      lettuce:
        pool:
          max-active: 16       # 连接池最大连接数
          max-idle: 8          # 最大空闲连接
          min-idle: 2
```

### 3. 两种 Template 的选择

Spring Data Redis 提供两个操作模板，**强烈建议默认用 `StringRedisTemplate`**：

| 模板 | 序列化方式 | 适用场景 |
| --- | --- | --- |
| `StringRedisTemplate` | key/value 都是字符串 | 通用、可读性好、跨语言兼容 |
| `RedisTemplate<Object,Object>` | JDK 序列化（默认） | 直接存对象，但 key 带乱码、不跨语言 |

```java
@Configuration
public class RedisConfig {

    // 用 StringRedisTemplate，value 自己用 JSON 序列化，可控且通用
    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory factory) {
        return new StringRedisTemplate(factory);
    }
}
```

### 4. 第一个 Demo：缓存一个对象

```java
@Service
public class UserService {

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public UserService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    /** 查询用户：先缓存后数据库 */
    public User getUser(Long id) {
        String key = "user:" + id;
        String json = redis.opsForValue().get(key);
        if (json != null) {
            // 缓存命中，反序列化返回
            try {
                return objectMapper.readValue(json, User.class);
            } catch (Exception e) {
                log.error("缓存反序列化失败", e);
            }
        }
        // 缓存未命中，查数据库
        User user = userMapper.selectById(id);
        if (user != null) {
            try {
                // 回写缓存，30 分钟过期
                redis.opsForValue().set(key,
                        objectMapper.writeValueAsString(user), 30, TimeUnit.MINUTES);
            } catch (Exception e) {
                log.error("缓存序列化失败", e);
            }
        }
        return user;
    }

    /** 更新用户：更新数据库 + 删除缓存（下次查询自动重建） */
    public void updateUser(User user) {
        userMapper.updateById(user);
        redis.delete("user:" + user.getId()); // 删缓存比更新缓存更简单可靠
    }
}
```

## 六、实战场景代码详解

### 场景 1：计数器（浏览量、限流）

用 String 的 `incr` 原子自增，天然支持并发：

```java
/** 文章浏览量 +1，返回最新值 */
public Long incrView(Long articleId) {
    String key = "view:article:" + articleId;
    return redis.opsForValue().increment(key);
}

/** 简单接口限流：同一个 key 每秒最多 10 次 */
public boolean tryAcquire(String clientIp) {
    String key = "rate:limit:" + clientIp;
    Long count = redis.opsForValue().increment(key);
    if (count == 1L) {
        // 第一次访问，设置 1 秒过期，实现"滑动窗口"近似效果
        redis.expire(key, 1, TimeUnit.SECONDS);
    }
    return count <= 10;
}
```

### 场景 2：分布式锁

多实例部署时，JVM 的 `synchronized` 无效，需要基于 Redis 的分布式锁。正确姿势是 `set key value NX EX` 一步完成（保证加锁和设置过期时间原子性）：

```java
public class RedisLock {

    private final StringRedisTemplate redis;
    private final ThreadLocal<String> requestId = new ThreadLocal<>();

    public RedisLock(StringRedisTemplate redis) {
        this.redis = redis;
    }

    /**
     * 尝试加锁
     * @param key      锁的 key
     * @param expireMs 锁自动过期时间（毫秒），防止持有者宕机导致死锁
     */
    public boolean tryLock(String key, long expireMs) {
        String requestId = UUID.randomUUID().toString();
        Boolean ok = redis.opsForValue().setIfAbsent(key, requestId, expireMs, TimeUnit.MILLISECONDS);
        if (Boolean.TRUE.equals(ok)) {
            // 保存 requestId，释放锁时校验，防止误删别人的锁
            this.requestId.set(requestId);
            return true;
        }
        return false;
    }

    /** 释放锁：必须用 Lua 脚本保证"判断+删除"原子性 */
    public void unlock(String key) {
        String requestId = this.requestId.get();
        if (requestId == null) {
            return;
        }
        // Lua：只有 value 匹配才删除，避免锁过期后误删他人锁
        String script =
            "if redis.call('get', KEYS[1]) == ARGV[1] " +
            "then return redis.call('del', KEYS[1]) " +
            "else return 0 end";
        redis.execute(new DefaultRedisScript<>(script, Long.class),
                List.of(key), requestId);
    }
}
```

使用示例：

```java
@Autowired
private RedisLock redisLock;

public void createOrder(Long userId, Long orderId) {
    String lockKey = "lock:order:" + userId;
    if (!redisLock.tryLock(lockKey, 10_000)) {
        throw new BizException("操作太频繁，请稍后再试");
    }
    try {
        // 业务：防止重复下单
        doCreateOrder(userId, orderId);
    } finally {
        redisLock.unlock(lockKey);
    }
}
```

> 生产环境更推荐直接用 **Redisson**，它内置看门狗自动续期、可重入等能力，`RLock lock = redissonClient.getLock(key)` 即可，不用自己维护 Lua 脚本。

### 场景 3：排行榜（ZSet）

```java
/** 玩家分数 +5 */
public void addScore(String gameId, String userId, int score) {
    String key = "rank:game:" + gameId;
    redis.opsForZSet().incrementScore(key, userId, score);
}

/** 获取前 10 名（带分数） */
public List<RankItem> top10(String gameId) {
    String key = "rank:game:" + gameId;
    // 分数从高到低取前 10，value 是 userId，score 是分数
    Set<ZSetOperations.TypedTuple<String>> tuples =
            redis.opsForZSet().reverseRangeWithScores(key, 0, 9);
    List<RankItem> list = new ArrayList<>();
    if (tuples != null) {
        int rank = 1;
        for (ZSetOperations.TypedTuple<String> tuple : tuples) {
            list.add(new RankItem(rank++,
                    tuple.getValue(), tuple.getScore().longValue()));
        }
    }
    return list;
}

/** 查询某玩家排名（第几名，从 1 开始） */
public Long getRank(String gameId, String userId) {
    Long rank = redis.opsForZSet().reverseRank(keyOf(gameId), userId);
    return rank == null ? null : rank + 1;
}

private String keyOf(String gameId) {
    return "rank:game:" + gameId;
}
```

### 场景 4：延时队列（ZSet 按执行时间排序）

利用 ZSet 的 score 存"执行时间戳"，轮询时取 `score <= now` 的元素即可实现延时任务：

```java
@Component
public class DelayQueue {

    private static final String QUEUE_KEY = "delay:queue:order";
    private final StringRedisTemplate redis;

    /** 延迟 30 分钟后执行：score = 当前时间 + 30 分钟 */
    public void addDelayTask(String orderId, long delayMs) {
        redis.opsForZSet().add(QUEUE_KEY, orderId,
                System.currentTimeMillis() + delayMs);
    }

    /** 拉取到期的任务（订单超时未支付则取消） */
    @Scheduled(fixedDelay = 1000)
    public void poll() {
        long now = System.currentTimeMillis();
        // 取出 score <= now 的所有元素（最多 100 个）
        Set<String> ready = redis.opsForZSet().rangeByScore(QUEUE_KEY, 0, now, 0, 100);
        if (ready == null || ready.isEmpty()) {
            return;
        }
        for (String orderId : ready) {
            // 从队列移除（Redis 没有原子"取走"命令，先移除再处理，防止重复）
            Long removed = redis.opsForZSet().remove(QUEUE_KEY, orderId);
            if (removed != null && removed > 0) {
                cancelExpiredOrder(orderId); // 业务处理
            }
        }
    }

    private void cancelExpiredOrder(String orderId) {
        // 检查订单状态，超时未支付则取消
        System.out.println("取消超时订单: " + orderId);
    }
}
```

> 这只是轻量实现。要求高可靠（不丢消息、可重试）时，请使用 RocketMQ 的延时消息、RabbitMQ 的 TTL+死信队列，或 Redis 7 原生的 `dead-letter` 能力。

### 场景 5：去重（Set）

```java
/** 判断用户是否已点赞 + 点赞 */
public boolean like(Long userId, Long targetId) {
    String key = "like:target:" + targetId;
    Boolean added = redis.opsForSet().add(key, String.valueOf(userId));
    return Boolean.TRUE.equals(added); // 返回 false 说明之前已点赞
}

/** 点赞数 */
public Long likeCount(Long targetId) {
    return redis.opsForSet().size("like:target:" + targetId);
}

/** 判断是否已点赞（O(1)） */
public boolean hasLiked(Long userId, Long targetId) {
    return Boolean.TRUE.equals(
            redis.opsForSet().isMember("like:target:" + targetId,
                    String.valueOf(userId)));
}

/** 共同好友：交集 */
public Set<String> commonFollows(Long userId1, Long userId2) {
    return redis.opsForSet().intersect("follow:" + userId1, "follow:" + userId2);
}
```

### 场景 6：发布订阅（Pub/Sub）

Redis 自带简单的发布订阅，适合**实时通知**类场景（弹幕、在线状态通知）：

```java
/** 消息监听器 */
@Component
public class MessageListener implements MessageListener {
    @Override
    public void onMessage(Message message, byte[] pattern) {
        String channel = new String(message.getChannel());
        String body = new String(message.getBody());
        System.out.println("收到消息 channel=" + channel + ", body=" + body);
    }
}

@Configuration
public class RedisPubSubConfig {
    @Bean
    public RedisMessageListenerContainer container(RedisConnectionFactory factory,
                                                   MessageListener listener) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(factory);
        // 订阅频道 news:notify
        container.addMessageListener(listener, new ChannelTopic("news:notify"));
        return container;
    }
}

/** 发布消息 */
@RestController
public class NotifyController {
    private final StringRedisTemplate redis;

    @PostMapping("/notify")
    public void notify(@RequestBody String content) {
        // 发布到频道，所有订阅者都能收到
        redis.convertAndSend("news:notify", content);
    }
}
```

> 注意：Pub/Sub 是**即发即弃**的，订阅者不在线就收不到消息，不保证可靠投递。需要可靠消息请用消息队列。

### 场景 7：Pipeline 批量操作

当需要一次性写很多 key 时，用 Pipeline 把命令打包发送，**减少网络往返**，性能提升明显：

```java
public void batchSetUser(List<User> users) {
    redis.executePipelined((RedisCallback<Object>) connection -> {
        for (User user : users) {
            byte[] key = ("user:" + user.getId()).getBytes(StandardCharsets.UTF_8);
            byte[] value = jsonBytes(user);
            connection.stringCommands().set(key, value);
        }
        return null;
    });
}
```

### 场景 8：事务与 Lua 脚本

Redis 的 `multi/exec` 只能保证"一起执行、不被插队"，**不保证回滚**。真正需要"原子性 + 条件判断"的场景，用 **Lua 脚本**：

```java
// 示例：秒杀扣减库存，库存不足返回 0，成功返回 1
public boolean reduceStock(Long productId, int num) {
    String script =
        "local stock = tonumber(redis.call('get', KEYS[1]) or '0') " +
        "if stock < tonumber(ARGV[1]) then return 0 end " +
        "redis.call('decrby', KEYS[1], ARGV[1]) " +
        "return 1";
    DefaultRedisScript<Long> redisScript =
            new DefaultRedisScript<>(script, Long.class);
    Long result = redis.execute(redisScript,
            List.of("stock:product:" + productId),
            String.valueOf(num));
    return Long.valueOf(1).equals(result);
}
```

### 场景 9：附近的人（GEO）

打车、外卖、"附近的人"这类 LBS 功能，用 GEO 一行命令就能搞定：

```java
@Service
public class DriverService {

    private static final String KEY = "geo:drivers:city";
    private final StringRedisTemplate redis;

    /** 司机上报位置（经度 lng、纬度 lat） */
    public void uploadLocation(String driverId, double lng, double lat) {
        redis.opsForGeo().add(KEY, new Point(lng, lat), driverId);
    }

    /** 查找附近司机：以用户为中心 radiusKm 公里内，按距离从近到远 */
    public List<NearDriver> nearbyDrivers(double lng, double lat, double radiusKm) {
        Circle circle = new Circle(new Point(lng, lat), new Distance(radiusKm, Metrics.KILOMETERS));
        GeoResults<RedisGeoCommands.GeoLocation<String>> results =
                redis.opsForGeo().radius(KEY, circle,
                        RedisGeoCommands.GeoRadiusCommandArgs.newGeoRadiusArgs()
                                .includeDistance()   // 结果带距离
                                .sortAscending());   // 按距离升序
        List<NearDriver> list = new ArrayList<>();
        if (results != null) {
            for (GeoResult<RedisGeoCommands.GeoLocation<String>> result : results) {
                String driverId = result.getContent().getName();
                double distKm = result.getDistance() == null
                        ? 0 : result.getDistance().getValue();
                list.add(new NearDriver(driverId, distKm));
            }
        }
        return list;
    }

    /** 计算两个司机之间的直线距离（单位 km） */
    public Double distance(String driverId1, String driverId2) {
        Distance d = redis.opsForGeo().distance(KEY, driverId1, driverId2, Metrics.KILOMETERS);
        return d == null ? null : d.getValue();
    }
}
```

> 注意：GEO 底层是 ZSet，可以用 `zrem` 删除成员、`zrange` 遍历，但**不能**对 score（经纬度编码）做业务含义上的解读。

### 场景 10：用户签到（Bitmap）

签到功能用 Bitmap 极其省内存，1 个 key 就能标记全量用户当天的签到状态：

```java
@Service
public class SignService {

    private final StringRedisTemplate redis;

    /** 用户签到：偏移量直接用用户 id */
    public boolean signIn(Long userId) {
        String key = "sign:" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        return Boolean.TRUE.equals(redis.opsForValue().setBit(key, userId, true));
    }

    /** 查询今天是否已签到 */
    public boolean hasSigned(Long userId) {
        String key = "sign:" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        return Boolean.TRUE.equals(redis.opsForValue().getBit(key, userId));
    }

    /** 今天签到的总人数 */
    public Long todaySignCount() {
        String key = "sign:" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        return redis.execute((RedisCallback<Long>) connection ->
                connection.stringCommands()
                        .bitCount(key.getBytes(StandardCharsets.UTF_8)));
    }
}
```

## 七、Key 命名与最佳实践

### 1. 命名规范

- **用冒号分层**：`业务:实体:id`，如 `user:1001`、`article:detail:88`；
- **前缀统一**：方便按前缀 `scan` 和排查问题；
- **可读性好**：尽量不要出现中文和特殊字符。

### 2. 常见坑与建议

| 问题 | 建议 |
| --- | --- |
| `keys *` 阻塞 Redis | 生产禁用，用 `scan` 游标分批遍历 |
| 大 key / 大 value | 单 value 控制在几十 KB 内，太大拆分成 Hash 分片 |
| 缓存不一致 | 更新用「删缓存」而非「更新缓存」，配合延迟双删 |
| 过期时间统一 | TTL 加随机值，避免缓存雪崩 |
| 连接泄露 | 使用连接池（lettuce + pool），用完自动归还 |
| 持久化关闭 | 纯缓存场景可不开，但别依赖 Redis 做唯一数据源 |

## 八、总结

- **基础类型记场景**：String 缓存与计数、Hash 存对象、List 做队列、Set 去重、ZSet 排行；
- **扩展类型记场景**：GEO 找附近、HyperLogLog 数 UV、Bitmap 做签到、Stream 做可靠消息队列；
- **命令记核心**：`set/get/incr`、`hset/hget`、`lpush/brpop`、`sadd/sismember`、`zadd/zrange`、`geoadd/georadius`、`pfadd/pfcount`、`setbit/bitcount`；
- **Spring Boot 记模板**：默认 `StringRedisTemplate` + JSON 序列化最稳；
- **进阶记原子性**：分布式锁、扣库存、限流这类并发敏感操作，一律用 `set NX EX` 或 Lua 脚本保证原子。

Redis 用得好不好，关键在于**选对数据类型 + 把命令用对**。把上面这些场景的代码跑一遍，就基本掌握了 Redis 的日常用法。
