# A connect middleware for prometheus

## Features
* Support cluster
* Support multiple clusters via `broadcast-channel`
* Aggregate metrics automatically

## Usage
```js
import Prometheus from 'connect-prometheus'
import Express from 'express'

const app = Express()
app.use(Prometheus())

app.get('/metrics', (req, res, next) => {
  req
    .getMetrics()
    .then(metrics => res.send(metrics))
    .catch(next)
})

```
