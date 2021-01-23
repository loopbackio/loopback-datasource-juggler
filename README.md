# loopback-datasource-juggler

An ORM/ODM that provides a common set of interfaces for interacting with databases, REST APIs, and other types of data sources. It was originally forked from [JugglingDB](https://github.com/1602/jugglingdb).

## Supported versions

This module adopts the [Module Long Term Support (LTS)](http://github.com/CloudNativeJS/ModuleLTS) policy, with the following End Of Life (EOL) dates:

| Version    | Status          | Published | EOL                  |
| ---------- | --------------- | --------- | -------------------- |
| 4.x        | Current         | Oct 2018  | Apr 2023 _(minimum)_ |
| 3.x        | End-of-Life     | Dec 2016  | Dec 2020             |
| 2.x        | End-of-Life     | Jul 2014  | Apr 2019             |

Learn more about our LTS plan in the [LoopBack documentation](http://loopback.io/doc/en/contrib/Long-term-support.html).

## Usage

Install Juggler:

```
npm install loopback-datasource-juggler
```

Then install a connector:

```
npm install loopback-connector-mongodb // in this case, the mongodb connector
```

## Documentation

See the [LoopBack documentation](http://loopback.io/doc/en/lb3/index.html).

For information on data source connectors, see [Connecting models to data sources](https://loopback.io/doc/en/lb3/Connecting-models-to-data-sources.html).


## Contributing

This project uses [DCO](https://developercertificate.org/). Be sure to sign off
your commits using the `-s` flag or adding `Signed-off-By: Name<Email>` in the
commit message.

**Example**

```
git commit -s -m "feat: my commit message"
```

Also see the [Contributing to LoopBack](https://loopback.io/doc/en/contrib/code-contrib.html) to get you started.
