var exec = require('child_process').exec
var fs = require('fs')
var https = require('https')
var path = require('path')
var shasum = require('crypto').createHash('sha1')
var mkdirp = require('mkdirp')
var url = require('../config').url
var dirname = require('../config').dirname

module.exports = function (version, cb) {
  cb = typeof cb === 'function' ? cb : false
  var body = ''
  if (version.substring(0, 1) !== 'v') version = 'v' + version
  var exists = fs.existsSync(path.join(dirname.src, version))
  if (exists) {
    console.log(version + ' is already installed.\n')
  }
  version = version.substr(1)

  https.get(url, function (res) {
    if (res.statusCode !== 200) {
      var message = 'Error: Server responsed status code '
      message += res.statusCode
      console.error(message)
    }
    res.on('data', function (chunk) { body += chunk })

    res.on('end', function () {
      body = JSON.parse(body)
      var versions = Object.keys(body.versions)
      if (versions.indexOf(version) === -1) {
        console.log('Unknown version: ' + version)
        return
      }
      var dist = body.versions[version].dist
      var buffer = []
      var buffersize = 0
      https.get(dist.tarball, function (res) {
        res.on('data', function (chunk) {
          buffer.push(chunk)
          buffersize += chunk.length
        })
        res.on('end', function () {
          var data = Buffer.concat(buffer, buffersize)
          shasum.update(data)
          if (shasum.digest('hex') !== dist.shasum) {
            console.error('Error: Download data is broken')
            return
          }
          var exists = fs.existsSync(dirname.src)
          if (!exists) mkdirp.sync(dirname.src)
          var file = dirname.src + '/npm-' + version + '/npm-'
          file += version + '.tgz'
          mkdirp.sync(dirname.src + '/npm-' + version)
          fs.openSync(file, 'w+')
          var writeStream = fs.createWriteStream(file)
          writeStream.on('error', function (e) {
            console.error(e.message)
          })
          writeStream.write(data, 'binary')
          writeStream.end()
          writeStream.on('close', function () {
            var command = 'tar -zxf ' + file
            command += ' -C ' + dirname.src + '/npm-' + version
            exec(command, {encoding: 'utf8'}, function () {
              var oldPath = dirname.src + '/npm-' + version + '/package'
              var newPath = dirname.npm + '/v' + version
              var exists = fs.existsSync(dirname.npm)
              if (!exists) mkdirp.sync(dirname.npm)
              exists = fs.existsSync(newPath)
              if (!exists) fs.renameSync(oldPath, newPath)
              exec(
                'cd ' + newPath + ' npm install',
                {encoding: 'utf8'},
                function (error) {
                  if (cb) {
                    cb(null)
                  } else if (error) {
                    console.log(error)
                  } else {
                    console.log('installed')
                  }
                }
              )
            })
          })
        })
      }).on('error', function (e) {
        console.error(e.message)
      })
    })
  }).on('error', function (e) {
    console.error(e.message)
  })
}
