# loopback-datasource-juggler

An ORM/ODM that provides a common set of interfaces for interacting with databases, REST APIs, and other types of data sources. It was originally forked from [JugglingDB](https://github.com/1602/jugglingdb). 

In LoopBack 4, it is part of the `@loopback/repository` module. See [Repository page](https://loopback.io/doc/en/lb4/Repository.html) in LoopBack 4 for more details. 

## Supported versions

This module adopts the [Module Long Term Support (LTS)](http://github.com/CloudNativeJS/ModuleLTS) policy, with the following End Of Life (EOL) dates:

| Version    | Status          | Published | EOL                  |
| ---------- | --------------- | --------- | -------------------- |
| 5.x        | Current         | Sep 2023  | Apr 2028 _(minimum)_ |
| 4.x        | End-of-Life     | Oct 2018  | Apr 2025             |
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

See the [LoopBack documentation](https://loopback.io/doc/en/lb4/index.html) and [DataSource page](https://loopback.io/doc/en/lb4/DataSource.html).


## Contributing

This project uses [DCO](https://developercertificate.org/). Be sure to sign off
your commits. For details, see [Contributing to LoopBack](https://loopback.io/doc/en/contrib/code-contrib.html).
