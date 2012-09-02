var gitteh = require("gitteh"),
    exec = require("child_process").exec,
    mime = require("mime"),
    path = require("path");

// Since we have to exec git rev-parse, make sure the arguments are safe.
var safeRe = /^[0-9A-Za-z_.~/-]+$/;

exports.route = function() {
  var repository = defaultRepository,
      sha = defaultSha,
      file = defaultFile,
      type = defaultType;

  function route(request, response) {
    var repository_,
        sha_,
        file_;

    if ((repository_ = repository(request.url)) == null
        || !safeRe.test(repository_)
        || (sha_ = sha(request.url)) == null
        || !safeRe.test(sha_)
        || (file_ = file(request.url)) == null
        || !safeRe.test(file_)) return serveNotFound();

    gitteh.openRepository(repository_, function(error, repository) {
      return error ? serveError(error) : serveReference(sha_);

      // Until gitteh supports rev-parse, this is the best we can do.
      function serveReference(reference) {
        exec("git rev-parse " + reference + ":" + file_, {cwd: repository_}, function(error, stdout, stderr) {
          if (error) return error.code === 128 ? serveNotFound() : serveError(error);
          serveBlob(stdout.toString().trim());
        });
      }

      function serveBlob(sha) {
        repository.getBlob(sha, function(error, blob) {
          if (error) return serveError(error);
          response.writeHead(200, {"Content-Type": type(file_)});
          response.end(blob.data);
        });
      }
    });

    function serveError(error) {
      response.writeHead(500, {"Content-Type": "text/plain"});
      response.end(error + "");
    }

    function serveNotFound() {
      response.writeHead(404, {"Content-Type": "text/plain"});
      response.end("File not found.");
    }
  }

  route.repository = function(_) {
    if (!arguments.length) return repository;
    repository = functor(_);
    return route;
  };

  route.sha = function(_) {
    if (!arguments.length) return sha;
    sha = functor(_);
    return route;
  };

  route.file = function(_) {
    if (!arguments.length) return file;
    file = functor(_);
    return route;
  };

  route.type = function(_) {
    if (!arguments.length) return type;
    type = functor(_);
    return route;
  };

  return route;
};

function functor(_) {
  return typeof _ === "function" ? _ : function() { return _; };
}

function defaultRepository() {
  return path.join(__dirname, "repository");
}

function defaultSha(url) {
  return url.substring(1, url.indexOf("/", 1));
}

function defaultFile(url) {
  return url.substring(url.indexOf("/", 1) + 1);
}

function defaultType(file) {
  var type = mime.lookup(file, "text/plain");
  return text(type) ? type + "; charset=utf-8" : type;
}

function text(type) {
  return /^(text\/)|(application\/(javascript|json)|image\/svg$)/.test(type);
}
