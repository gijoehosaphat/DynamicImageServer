///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Libraries, dependencies
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var express = require('express'),
    gm = require('gm'),
    fs = require('fs');


///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Config
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Setup
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var app = module.exports = express.createServer();

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// App Configuration
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.configure(function() {
    app.enable("case sensitive routes");
    app.use(express.methodOverride());
    app.use(app.router);
});

app.configure("development", function() {
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure("production", function() {
    app.use(express.errorHandler());
});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Middleware
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var imageParse = function(request, response, next) {
    var url = request.params[0];
    var path = url.substring(0, url.lastIndexOf('/') + 1);
    var originalName = url.substring(url.lastIndexOf('/') + 1);
    var name = originalName.substring(0, originalName.indexOf('_')) + originalName.substring(originalName.lastIndexOf('.'));

    var manipulators = [];
    if (originalName.indexOf('_') !== -1) {
        var parameterString = originalName.substring(originalName.indexOf('_') + 1, originalName.lastIndexOf('.')).trim();
        var parameterPairs = parameterString.split('_');
        for (var i in parameterPairs) {
            var parameterPair = parameterPairs[i].split('=');
            var type = parameterPair[0];
            var parameterValues = parameterPair[1].split('+');
            var value = [];
            for (var x in parameterValues) {
                value.push(parameterValues[x]);
            }
            var manipulator = {
                type: type,
                value: value
            };
            manipulators.push(manipulator);
        }
    }

    var srcPath = __dirname + '/../' + path + name;
    var dstPath = __dirname + '/../public/' + path + originalName;

    request.image = {
        url: url,
        path: path,
        name: name,
        srcPath: srcPath,
        dstPath: dstPath,
        manipulators: manipulators
    };
    
    next();
};

var imageLoad = function(request, response, next) {
    gm(request.image.srcPath).identify(function(err, info) {
        if (err) {
            throw err;
        }
        request.image.info = info;
        next();
    });
};

var imageProcess = function(request, response, next) {
    var image = gm(request.image.srcPath);

    for (var i in request.image.manipulators) {
        var manipulator = request.image.manipulators[i];
        try {
            image = image[manipulator.type].apply(image, manipulator.value);
        } catch (ex) {
            throw new Error('Invalid parameters.');
        }
    }

    request.imageToWrite = image;
    
    next();
};

var imageWrite = function(request, response, next) {
    if (request.imageToWrite) {
        request.imageToWrite.write(request.image.dstPath, function (err) {
            if (err) {
                throw err;
            } else {
                next();
            }
        });
    } else {
        throw new Error('Image could not be processed?');
    }
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Routes
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get(/^\/process\/(.*)/, imageParse, imageLoad, imageProcess, imageWrite, function(request, response) {
    fs.readFile(request.image.dstPath, function(err, image) {
        if (err) {
            throw err;
        }

        console.log('Deleting: ' + request.image.dstPath);
        fs.unlinkSync(request.image.dstPath);
        console.log(request.image);

//        response.writeHead(200, {'Content-Type': 'image/jpeg' });
//        response.end(image, 'binary');
        response.json(request.image);
    });
});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Server
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.listen(3000);
console.log("Listening on port %d in %s mode", app.address().port, app.settings.env);