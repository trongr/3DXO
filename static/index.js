
var K = (function(){

    var K = {}

    K.INIT_CAM_POS = 15
    K.INIT_LIGHT_POS = 10
    K.BOARD_SIZE = 100
    K.CUBE_SIZE = 1
    K.CUBE_GEO = new THREE.BoxGeometry( K.CUBE_SIZE, K.CUBE_SIZE, K.CUBE_SIZE )

    return K
}())

var H = (function(){
    var H = {}

    H.log = function(msg, obj){
        if (obj) console.log(new Date().getTime() + " " + msg + " " + JSON.stringify(obj, 0, 2))
        else console.log(new Date().getTime() + " " + msg)
    }

    H.swapObjKeyValues = function(obj){
        var new_obj = {};
        for (var prop in obj) {
            if(obj.hasOwnProperty(prop)) {
                new_obj[obj[prop]] = prop;
            }
        }
        return new_obj;
    }

    H.length = function(obj) {
        var size = 0, key;
        for (key in obj) {
            if (obj.hasOwnProperty(key)) size++;
        }
        return size;
    };

    return H
}())

var Sock = (function(){
    var Sock = {}

    var _sock = null
    var _socketAutoReconnectTimeout = null

    Sock.init = function(){
        _sock = new SockJS('http://localhost:8080/move');

        _sock.onopen = function() {
            msg.info("Opening socket connection")
            H.log("INFO. opening socket connection")
            clearTimeout(_socketAutoReconnectTimeout)
        };

        _sock.onmessage = function(e) {
            msg.info("Received message " + e.data)
            H.log("INFO. socket message", e)
        };

        _sock.onclose = function() {
            H.log("WARNING. closing socket")
            msg.warning("Losing socket connection. Retrying in 5s...")
            setTimeout(function(){
                Sock.init()
            }, 5000)
        };
    }

    // mach
    Sock.test = function(){
        msg.info("sending socket test")
        _sock.send('test');
    }

    return Sock
}())

var API = (function(){
    var API = {}

    API.req = function(method, url, data, done){
        $.ajax({
            type: method,
            url: url,
            data: data,
            dataType: 'json',
            xhrFields: {
                withCredentials: true
            },
            success: function(re, status, xhr){
                done(null, re)
            },
            error: function (xhr, status, er){
                done(er)
            },
            // complete: function (xhr, status){}
        });
    }

    API.Player = (function(){
        var Player = {}

        Player.get = function(data, done){
            var url = "/api/v1/player"
            API.req("get", url, data, function(er, re){
                if (re && re.player) done(null, re.player)
                else done({msg:"no player found", re:re, er:er})
            })
        }

        return Player
    }())

    API.Cells = (function(){
        var Cells = {}

        Cells.get = function(data, done){
            var url = "/api/v1/cell/" + data.x + "/" + data.y + "/" + data.r
            API.req("get", url, data, function(er, re){
                if (re && re.cells) done(null, re.cells)
                else done({msg:"no cells found", re:re, er:er})
            })
        }

        return Cells
    }())

    return API
}())

var Orientation = (function(){
    var Orientation = {}

    // get up right and into axes relative to camera orientation
    //
    // into is biggest component of camLookAt
    // up is biggest component of camUp
    // right is cross product of into and up
    Orientation.getAxesRelativeToCamera = function(camera){
        var camUp = camera.up
        var camLookAt = Orientation.getCamLookAt(camera)

        var camUpMaxComponent = Orientation.getComponentWithMaxMagnitude(camUp)
        var camLookAtMaxComponent = Orientation.getComponentWithMaxMagnitude(camLookAt)

        var into = new THREE.Vector3()
        var up = new THREE.Vector3()
        var right = null

        into.setComponent(camLookAtMaxComponent, camLookAt.getComponent(camLookAtMaxComponent))
        up.setComponent(camUpMaxComponent, camUp.getComponent(camUpMaxComponent))
        right = new THREE.Vector3().crossVectors(into, up)

        return {into:into.normalize(), up:up.normalize(), right:right.normalize()}
    }

    Orientation.getComponentWithMaxMagnitude = function(v){
        var valuesSorted = [
            Math.abs(v.x),
            Math.abs(v.y),
            Math.abs(v.z),
        ].sort(function(a, b){
            return a - b
        })

        var valueAxes = {}
        valueAxes[Math.abs(v.x)] = 0 // "x"
        valueAxes[Math.abs(v.y)] = 1 // "y"
        valueAxes[Math.abs(v.z)] = 2 // "z"

        return valueAxes[valuesSorted[2]]
    }

    Orientation.getCamLookAt = function(camera){
        return new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    }

    return Orientation
}())

var KeyNav = (function(){
    var KeyNav = {}

    KeyNav.init = function(){
        KeyNav.initListeners()
    }

    KeyNav.initListeners = function(){
        document.addEventListener( 'keydown', onDocumentKeyDown, false );
    }

    function onDocumentKeyDown( event ) {
        switch( event.keyCode ) {
        case 65: moveLeft(Rollover.getMesh(), Scene.camera); break; // A
        case 68: moveRight(Rollover.getMesh(), Scene.camera); break; // D
        case 81: moveAway(Rollover.getMesh(), Scene.camera); break; // Q
        case 83: moveDown(Rollover.getMesh(), Scene.camera); break; // S
        case 87: moveUp(Rollover.getMesh(), Scene.camera); break; // W
        case 69: moveInto(Rollover.getMesh(), Scene.camera); break; // E
        }
        Scene.render()
    }

    function moveInto(mesh, camera){
        mesh.position.add(Orientation.getAxesRelativeToCamera(camera).into.multiplyScalar(K.CUBE_SIZE))
    }

    function moveAway(mesh, camera){
        mesh.position.add(Orientation.getAxesRelativeToCamera(camera).into.multiplyScalar(-K.CUBE_SIZE))
    }

    function moveUp(mesh, camera){
        mesh.position.add(Orientation.getAxesRelativeToCamera(camera).up.multiplyScalar(K.CUBE_SIZE))
    }

    function moveDown(mesh, camera){
        mesh.position.add(Orientation.getAxesRelativeToCamera(camera).up.multiplyScalar(-K.CUBE_SIZE))
    }

    function moveRight(mesh, camera){
        mesh.position.add(Orientation.getAxesRelativeToCamera(camera).right.multiplyScalar(K.CUBE_SIZE))
    }

    function moveLeft(mesh, camera){
        mesh.position.add(Orientation.getAxesRelativeToCamera(camera).right.multiplyScalar(-K.CUBE_SIZE))
    }

    return KeyNav
}())

var Select = (function(){
    var Select = {}

    var _isSelecting
    var _raycaster
    var _mouse
    var _selected

    Select.init = function(){
        _isSelecting = false
        _raycaster = new THREE.Raycaster();
        _mouse = new THREE.Vector2();
    }

    Select.getIntersect = function(clientX, clientY){
        _mouse.set( ( clientX / window.innerWidth ) * 2 - 1, - ( clientY / window.innerHeight ) * 2 + 1 );
        _raycaster.setFromCamera(_mouse, Scene.camera);
        return _raycaster.intersectObjects(Obj.getObjects())[0];
    }

    Select.select = function(clientX, clientY){
        var intersect = Select.getIntersect(clientX, clientY)
        if (!intersect) return
        if (_isSelecting){
            var moved = Game.move(_selected, new THREE.Vector3()
                                  .copy(intersect.point)
                                  .add(new THREE.Vector3()
                                       .copy(intersect.face.normal)
                                       .multiplyScalar(0.5))) // normal's unit length so gotta scale by half to fit inside the box
            if (moved) _isSelecting = false
            else _isSelecting = true
        } else { // start selecting
            if (Player.objBelongsToPlayer(intersect.object)){
                _selected = intersect.object
                Obj.highlight(intersect.object, true)
                Move.highlightAvailableMoves(intersect.object)
                _isSelecting = true
            } else {
                Obj.highlight(_selected, false)
                _isSelecting = false
            }
        }
    }

    return Select
}())

var Rollover = (function(){
    var Rollover = {}

    var ROLLOVER_MATERIAL = new THREE.MeshLambertMaterial({color:0xffffff, shading:THREE.FlatShading, opacity:0.3, transparent:true})
    var ROLLOVER_GEOMETRY = new THREE.BoxGeometry(K.CUBE_SIZE + 0.01, K.CUBE_SIZE + 0.01, K.CUBE_SIZE + 0.01) // 0.01 extra to prevent highlight from clipping with cube surface
    var _rollover

    Rollover.init = function(){
        _rollover = new THREE.Mesh(ROLLOVER_GEOMETRY, ROLLOVER_MATERIAL);
        Scene.addObj(_rollover)
        // Obj.move(_rollover, new THREE.Vector3(0, 0, 0))
        // document.addEventListener( 'mousemove', onDocumentMouseMove, false );
    }

    Rollover.getMesh = function(){
        return _rollover
    }

    // ref.
    Rollover.setColor = function(color){
        if (color == null) _rollover.material.color.setRGB(1, 0, 0)
        else _rollover.material.color = color
    }

    function onDocumentMouseMove( event ) {
        event.preventDefault();
        var intersect = Select.getIntersect(event.clientX, event.clientY)
        if (intersect) {
            Obj.move(Rollover.getMesh(), new THREE.Vector3().copy(intersect.point).add(intersect.face.normal))
        }
        Scene.render();
    }

    return Rollover
}())

// todo. make Rollover part of Highlight
var Highlight = (function(){
    var Highlight = {}

    var HIGHLIGHT_MATERIALS = {
        red: new THREE.MeshLambertMaterial({color:0xff0000, shading:THREE.FlatShading, opacity:0.3, transparent:true}),
        green: new THREE.MeshLambertMaterial({color:0x00ff00, shading:THREE.FlatShading, opacity:0.3, transparent:true}),
    }
    var HIGHLIGHT_GEOMETRY = new THREE.BoxGeometry(K.CUBE_SIZE + 0.01, K.CUBE_SIZE + 0.01, 0.01)

    Highlight.COLORS = {
        red: "red",
        green: "green",
    }

    var _highlights = {
        red: [],
        green: [],
    }

    Highlight.highlightCells = function(moves){
        for (var i = 0; i < moves.length; i++){
            var move = moves[i]
            var position = move.xyz
            var color = move.kill ? "red" : "green"
            var highlight = _highlights[color][i] || Highlight.makeHighlight(color)
            highlight.visible = true
            Obj.move(highlight, new THREE.Vector3(position.x, position.y, position.z))
            // Obj.standUpRight(highlight, true) // force==true to force up right for nonplayer blocks
            highlight.position.copy(Obj.findGround(position.x, position.y, position.z).point) // can't use Obj.move() cause it realigns fraction to integer positions
        }
    }

    Highlight.makeHighlight = function(color){
        var highlight = new THREE.Mesh(HIGHLIGHT_GEOMETRY, HIGHLIGHT_MATERIALS[color]);
        Scene.addObj(highlight)
        _highlights[color].push(highlight)
        return highlight
    }

    Highlight.hideHighlights = function(color){
        for (var i = 0; i < _highlights[color].length; i++){
            _highlights[color][i].visible = false
        }
    }

    Highlight.hideAllHighlights = function(){
        for (var color in Highlight.COLORS) {
            if (Highlight.COLORS.hasOwnProperty(color)){
                Highlight.hideHighlights(color)
            }
        }
    }

    return Highlight
}())

var Player = (function(){
    var Player = {}

    var _player = null

    Player.init = function(done){
        // mach player name
        var name = "trong"
        API.Player.get({name:name}, function(er, player){
            if (er){
                msg.error("Can't load player: " + name)
                return done(er.msg)
            }
            _player = player
            done(null)
        })
    }

    Player.objBelongsToPlayer = function(obj){
        return obj.game.isFriendly == 1
    }

    // mach
    Player.isFriendly = function(cell){
        if (cell.piece.player == _player._id) return 1
        else return 0
    }

    return Player
}())

var Obj = (function(){
    var Obj = {}

    var TEXTURES_ROOT = "/static/images/small/"
    // dummy origin and direction, near==0, far==1 because we only
    // want to find the ground adjacent to an obj
    var _groundRaycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(), 0, 1)
    var _objects = []

    Obj.KIND = {
        pawn: null, // load in Obj.init
        ground0: {
            material: new THREE.MeshPhongMaterial({color:0xffffff, shading:THREE.FlatShading, side:THREE.DoubleSide, reflectivity:0.5}),
        },
        ground1: {
            material: new THREE.MeshPhongMaterial({color:0xb78e5d, shading:THREE.FlatShading, side:THREE.DoubleSide, reflectivity:0.5}),
        },
    }

    function loadFaceTextures(textureName, otherFacesColor){
        var materials = []
        for (var i = 0; i < 6; i++){
            materials.push(new THREE.MeshPhongMaterial({color:otherFacesColor, shading:THREE.FlatShading, side:THREE.DoubleSide}))
        } // use colors for non image faces
        materials[4] = new THREE.MeshLambertMaterial({
            map:THREE.ImageUtils.loadTexture(TEXTURES_ROOT + textureName + "4.png", {}, function(){
                Scene.render()
            })
        })
        return materials
    }

    Obj.init = function(done){
        // material[0] and [1] are for friendly and enemy pieces
        Obj.KIND.pawn = {
            material: [
                new THREE.MeshFaceMaterial(loadFaceTextures("p0pawn", 0xff4545)),
                new THREE.MeshFaceMaterial(loadFaceTextures("p1pawn", 0x0060ff)),
            ],
        }
        // if you load the map before the game pieces, the pieces'
        // faces will all have the same texture. what the heck
        //
        // todo. you're loading game pieces first and then the map,
        // which is bad because without the map the pieces can't
        // tell which direction is up. for now it's OK, but will
        // become a problem once you start loading pieces on different
        // faces of the cube. in that case, once you've loaded the
        // game pieces, then the map, do another pass through the
        // pieces and stand them up right.
        API.Cells.get({x:0, y:0, r:0}, function(er, _cells){
            if (er) return done(er.msg)
            var cells = []
            for (var i = 0; i < _cells.length; i++){
                var cell = _cells[i]
                var isFriendly = Player.isFriendly(cell)
                cells.push(Obj.make(isFriendly, cell.piece.kind, cell.x, cell.y, 1))
            }
            var TOTAL_PLAYERS = 1
            Obj.loadGamePieces(cells)
            Obj.initMap()
            done(null)
        })
    }


    Obj.initMap = function(){
        Map.init() // keep map block positions separately in Map
        var map = Map.getMap()
        for (var i = 0; i < map.length; i++){
            var x = map[i].x
            var y = map[i].y
            var z = map[i].z
            var index = ((x + y + z) % 2 + 2) % 2 // alternating odd and even cell
            var mapBlock = Obj.make(null, "ground" + index, x, y, z)
            Obj.addObj(mapBlock) // but also add the actual blocks to the world
        }
    }

    Obj.loadGamePieces = function(objs){
        for (var i = 0; i < objs.length; i++){
            Obj.addObj(objs[i])
        }
    }

    // Right now isFriendly is either null, or 0 or 1, to distinguish
    // non-player, or friendly or enemy pieces.
    Obj.getMaterial = function(isFriendly, kind){
        if (isFriendly == null) return Obj.KIND[kind].material // non player materials are unique
        else return Obj.KIND[kind].material[isFriendly]
    }

    // todo. better classing. right now ground blocks have kind null
    Obj.make = function(isFriendly, kind, x, y, z){
        var mat = Obj.getMaterial(isFriendly, kind)
        var obj = Obj.makeBox(new THREE.Vector3(x, y, z), mat)
        obj.game = {
            // team: team, // todo
            isFriendly: isFriendly,
            kind: kind,
        }
        return obj
    }

    // mac
    Obj.move = function(obj, point){
        obj.position
            .copy(point)
            .divideScalar( K.CUBE_SIZE ).floor()
            .multiplyScalar( K.CUBE_SIZE )
            .addScalar( K.CUBE_SIZE / 2 );
        // Obj.standUpRight(obj) // don't need this anymore cause we're always upright
    }

    Obj.highlight = function(obj, isHigh){
        if (!obj) return
        if (isHigh) Obj.move(Rollover.getMesh(), obj.position)
        else Obj.move(Rollover.getMesh(), new THREE.Vector3(0, 0, 0)) // just move the rollover out of sight
    }

    Obj.makeBox = function(position, material){
        var box = new THREE.Mesh(K.CUBE_GEO, material);
        box.position.copy(position);
        box.position.divideScalar( K.CUBE_SIZE ).floor().multiplyScalar( K.CUBE_SIZE ).addScalar( K.CUBE_SIZE / 2 );
        box.castShadow = true;
        box.receiveShadow = true;
        return box
    }

    // todo. blacklist ground blocks instead of whitelisting other stuff
    Obj.standUpRight = function(obj, force){
        if (Obj.isPlayerObj(obj) || force){
            var ground = Obj.findGround(obj.position.x, obj.position.y, obj.position.z) // find the ground so you know where up is
            var up = new THREE.Vector3()
                .copy(ground.point)
                .add(ground.face.normal)
            obj.lookAt(up)
        } // else it's the ground and we don't need to stand it up right
    }

    // todo. if there are more than two "grounds" e.g. at a wall, this
    // will pick the first ground it finds, which might not look
    // good. in that case the block should keep its current up
    // orientation
    Obj.findGround = function(x, y, z){
        var origin = new THREE.Vector3(Math.floor(x) + 0.5, // +0.5 so ray caster goes through cube face center
                                       Math.floor(y) + 0.5,
                                       Math.floor(z) + 0.5)
        for (var i = 0; i < 3; i++){ // 3 axes
            for (var j = 1; j <= 2; j++){ // forward and backward
                var direction = new THREE.Vector3()
                direction.setComponent(i, Math.pow(-1, j))
                _groundRaycaster.set(origin, direction)
                var intersects = _groundRaycaster.intersectObjects(_objects, false)
                for (var k = 0; k < intersects.length; k++){
                    var intersect = intersects[k]
                    if (intersect && Obj.isGround(intersect.object)) return intersect
                }
            }
        }
        return null
    }

    // todo. better classing
    Obj.isGround = function(obj){
        return !Obj.isPlayerObj(obj)
    }

    // todo. store things in a db for faster obj location
    Obj.findObjAtPosition = function(x, y, z){
        for (var i = 0; i < _objects.length; i++){
            var obj = _objects[i]
            var X = Math.floor(obj.position.x)
            var Y = Math.floor(obj.position.y)
            var Z = Math.floor(obj.position.z)
            if (X == x && Y == y && Z == z) return obj
        }
        return null
    }

    // todo. better classing
    Obj.isPlayerObj = function(obj){
        try {
            return (obj.game.player != null)
        } catch (e){
            return false
        }
    }

    Obj.getObjects = function(){
        return _objects
    }

    Obj.addObj = function(obj){
        _objects.push(obj)
    }

    Obj.getObj = function(index){
        return _objects[index]
    }

    return Obj
}())

var Map = (function(){
    var Map = {}

    var _map = []

    Map.init = function(){
        var mapSize = 8; // 16 by 16 by 1
        for (var x = -mapSize; x < mapSize; x++) {
            for (var y = -mapSize; y < mapSize; y++){
                Map.add({x:x, y:y, z:0})
            }
        }
    }

    // obj = {x:asdf, y:asdf, z:asdf}
    Map.add = function(obj){
        _map.push(obj)
    }

    Map.getMap = function(){
        return _map
    }

    return Map
}())

var Move = (function(){
    var Move = {}

    Move.range = {
        pawn: 2,
        rook: 8,
        knight: 1,
    }

    Move.directions = {
        ioo: [ 1,  0,  0],
        oio: [ 0,  1,  0],
        ooi: [ 0,  0,  1],
        iio: [ 1,  1,  0],
        ioi: [ 1,  0,  1],
        oii: [ 0,  1,  1],
        iii: [ 1,  1,  1],
        noo: [-1,  0,  0],
        ono: [ 0, -1,  0],
        oon: [ 0,  0, -1],
        nio: [-1,  1,  0],
        ino: [ 1, -1,  0],
        nno: [-1, -1,  0],
        noi: [-1,  0,  1],
        ion: [ 1,  0, -1],
        non: [-1,  0, -1],
        oni: [ 0, -1,  1],
        oin: [ 0,  1, -1],
        onn: [ 0, -1, -1],
        nii: [-1,  1,  1],
        ini: [ 1, -1,  1],
        iin: [ 1,  1, -1],
        nni: [-1, -1,  1],
        nin: [-1,  1, -1],
        inn: [ 1, -1, -1],
        nnn: [-1, -1, -1],
    }

    // don't allow moving in z axis
    Move.rules = {
        moves: {
            pawn: ["ioo", "oio", "noo", "ono"], // moving along axes
            rook: ["ioo", "oio", "noo", "ono"],
        },
        kills: {
            pawn: ["iio", "nio", "ino", "nno"], // diagonal kills
            rook: ["ioo", "oio", "noo", "ono"],
        }
    }

    // Store currently available moves once player clicks a piece to
    // move. Each item contains position and a direction, whether it's
    // a kill move or not, etc. Useful for sending to server to
    // validate when player moves.
    Move.validatedMoves = []

    Move.highlightAvailableMoves = function(obj){
        var moves = Move.findAvailableMoves(obj)
        moves.push.apply(moves, Move.findAvailableKills(obj))
        Highlight.highlightCells(Move.findAvailableMoves(obj))
        Move.validatedMoves = moves.filter(function(item){ // Cache available moves
            // // todo remove
            // var result = item.kill == false || item.killMove == true
            // if (result) console.log("it's a real move " + JSON.stringify(item, 0, 2))
            return item.kill == false || item.killMove == true // Only interested in actual moveable positions
        })
    }

    Move.findAvailableKills = function(obj){
        var range = Move.getRange(obj.game.kind)
        var killRules = Move.rules.kills[obj.game.kind]
        var moves = []
        for (var i = 0; i < killRules.length; i++){
            var _dirMoves = Move.findKillsInDirection(obj, [
                Math.floor(obj.position.x),
                Math.floor(obj.position.y),
                Math.floor(obj.position.z),
            ], Move.directions[killRules[i]], range, [])
            moves.push.apply(moves, _dirMoves)
        }
        return moves
    }

    Move.findAvailableMoves = function(obj){
        var range = Move.getRange(obj.game.kind)
        var moveRules = Move.rules.moves[obj.game.kind]
        var moves = []
        for (var i = 0; i < moveRules.length; i++){
            var _dirMoves = Move.findMovesInDirection(obj, [
                Math.floor(obj.position.x),
                Math.floor(obj.position.y),
                Math.floor(obj.position.z),
            ], Move.directions[moveRules[i]], range, [])
            moves.push.apply(moves, _dirMoves)
        }
        return moves
    }

    // recursively find available kill moves
    // return the whole move list if there is a final kill
    // otw return an empty list
    Move.findKillsInDirection = function(obj, from, direction, range, moves){
        if (range == 0) return [] // out of range

        var x = from[0] + direction[0]
        var y = from[1] + direction[1]
        var z = from[2] + direction[2]

        var validMove = Move.validateMove(obj, x, y, z, true) // kill move true
        if (!validMove) return [] // can't move here

        moves.push({
            xyz: validMove.xyz,
            kill: true,
            killMove: validMove.killMove, // the actual kill move, as opposed to intermediate cells
            direction: direction,
        })
        if (validMove.killMove) return moves
        else if (!validMove.more) return [] // can't move past this point
        else return Move.findKillsInDirection(obj, [
            x, y, z
        ], direction, --range, moves) // keep going
    }

    // recursively find available moves
    Move.findMovesInDirection = function(obj, from, direction, range, moves){
        if (range == 0) return moves // out of range

        var x = from[0] + direction[0]
        var y = from[1] + direction[1]
        var z = from[2] + direction[2]

        var validMove = Move.validateMove(obj, x, y, z, false)
        if (!validMove) return moves // can't move here

        moves.push({
            xyz: validMove.xyz,
            kill: false,
            direction: direction,
        })
        if (!validMove.more) return moves // can't move past this point
        else return Move.findMovesInDirection(obj, [
            x, y, z
        ], direction, --range, moves) // keep going
    }

    Move.validateMove = function(obj, x, y, z, isKill){
        var ground = Obj.findGround(x, y, z)
        var changingPlanes = false
        if (!ground){
            var xyz = Move.changePlanes(obj, x, y, z)
            if (!xyz) return null // blocks can't fly
            changingPlanes = true
            x = xyz.x // else if xyz: proceed as normal
            y = xyz.y
            z = xyz.z
        }
        var box = Obj.findObjAtPosition(x, y, z)
        if (!box){ // empty cell
            return {xyz:{x:x, y:y, z:z}, more:!changingPlanes} // more moves if not changingPlanes
        } else if (box.game.player == null){ // wall / ground
            return null
        } else if (box.game.player == obj.game.player){ // blocked by friendly
            return null
        } else if (box && isKill){ // blocked by enemy
            return {xyz:{x:x, y:y, z:z}, more:false, killMove:true}
        } else { // also blocked by enemy but not a kill move
            return null
        }
    }

    Move.isValidated = function(x, y, z){
        return $.grep(Move.validatedMoves, function(item){
            return item.xyz.x == x && item.xyz.y == y && item.xyz.z == z
        }).length > 0
    }

    // todo remove changePlanes feature
    Move.changePlanes = function(obj, x, y, z){
        var curGround = Obj.findGround(obj.position.x, obj.position.y, obj.position.z)
        var down = new THREE.Vector3(x, y, z).sub(new THREE.Vector3().copy(curGround.face.normal))
        var newGround = Obj.findGround(down.x, down.y, down.z)
        if (!newGround){ // too far above new plane ground level
            return null
        } else if (curGround.face.normal != newGround.face.normal){
            return {x:down.x, y:down.y, z:down.z}
        } else { // if the normals are the same then we haven't changed planes
            return null
        }
    }

    Move.getRange = function(objKind){
        return Move.range[objKind]
    }

    return Move
}())

var Scene = (function(){
    var Scene = {
        camera: null
    }

    var _scene
    var _container
    var _stats;
    var _controls, _renderer;
    var _isShiftDown = false;

    Scene.init = function(){
        _scene = new THREE.Scene();
        var length = Obj.getObjects().length
        for (var i = 0; i < length; i++){
            Scene.addObj(Obj.getObj(i))
        }

        initContainer()
        initStats()
        initInfo()
        initLights()
        initCamera()
        initControls()
        initListeners()
        initRenderer()

        Rollover.init()
        Select.init()
        KeyNav.init() // toggle

        Sock.init()

        animate();
        Scene.render();
    }

    Scene.addObj = function(obj){
        _scene.add(obj)
    }

    Scene.removeMesh = function(mesh){
        _scene.remove(mesh)
    }

    function initContainer(){
        _container = document.createElement( 'div' );
        document.body.appendChild(_container);
    }

    function initCamera(){
        Scene.camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, K.BOARD_SIZE * 10 );
        Scene.camera.position.z = K.INIT_CAM_POS; // for some reason you need this or track ball controls won't work properly
    }

    function initControls(){
        _controls = new THREE.TrackballControls(Scene.camera);
        _controls.rotateSpeed = 2.5;
        _controls.zoomSpeed = 1.5;
        _controls.panSpeed = 1.0;
        _controls.noZoom = false;
        _controls.noPan = false;
        _controls.staticMoving = true;
        _controls.dynamicDampingFactor = 0.3;
        _controls.keys = [ 65, 83, 68 ];
        _controls.addEventListener('change', Scene.render);
        // todo. adding this makes moving with the mouse really slow
        // document.addEventListener( 'mousemove', _controls.update.bind( _controls ), false ); // this fixes some mouse rotating reeeeeaaaal slow
    }

    function initLights(){
        var ambientLight = new THREE.AmbientLight(0xB080D1);
        Scene.addObj(ambientLight);
        Scene.addObj(createDirectionalLight(K.INIT_LIGHT_POS, 2 * K.INIT_LIGHT_POS, 3 * K.INIT_LIGHT_POS));
        Scene.addObj(createDirectionalLight(-K.INIT_LIGHT_POS, -2 * K.INIT_LIGHT_POS, -3 * K.INIT_LIGHT_POS));
    }

    function initRenderer(){
        _renderer = new THREE.WebGLRenderer( { antialias:false, alpha:true } );
        _renderer.setClearColor(0x02002B, 1);
        _renderer.setPixelRatio( window.devicePixelRatio );
        _renderer.setSize( window.innerWidth, window.innerHeight );

        _renderer.shadowMapEnabled = true;
        _renderer.shadowMapSoft = true;

        _renderer.shadowCameraNear = 3;
        _renderer.shadowCameraFar = Scene.camera.far;
        _renderer.shadowCameraFov = 45;

        _renderer.shadowMapType = THREE.PCFSoftShadowMap;
        _renderer.shadowMapBias = 0.0039;
        _renderer.shadowMapDarkness = 0.5;
        _renderer.shadowMapWidth = 1024;
        _renderer.shadowMapHeight = 1024;

        _container.appendChild( _renderer.domElement );
    }

    function initListeners(){
        document.addEventListener( 'mousedown', onDocumentMouseDown, false );
        document.addEventListener( 'keydown', onDocumentKeyDown, false );
        document.addEventListener( 'keyup', onDocumentKeyUp, false );
        window.addEventListener( 'resize', onWindowResize, false );
    }

    function initInfo(){
        var info = document.createElement( 'div' );
        info.style.color = "white"
        info.style.position = 'absolute';
        info.style.top = '10px';
        info.style.right = "10px";
        info.style.textAlign = 'right';
        info.innerHTML = '3DXO<br>'
            + "<strong>mouse</strong>: navigate<br>"
        // + "<strong>QWEASD</strong>: move box<br>"
            + '<strong>click</strong>: move box<br>'
        _container.appendChild( info );
    }

    function initStats(){
        _stats = new Stats();
        _stats.domElement.style.position = 'absolute';
        _stats.domElement.style.top = '0px';
        _stats.domElement.style.zIndex = 100;
        _container.appendChild( _stats.domElement );
    }

    function onDocumentMouseDown( event ) {
        event.preventDefault();
        if (event.which == 1){ // left mouse button
            Select.select(event.clientX, event.clientY)
            Scene.render()
        } else if (event.which == 2){ // middle mouse
            // using middle
        } else if (event.which == 3){ // right mouse
            // and right mouse buttons for navigation
        }
    }

    function onDocumentKeyDown( event ) {
        switch( event.keyCode ) {
            // case 32: placeCube(Rollover.getMesh().position); break; // space
        case 16: _isShiftDown = true; break;
        }
        Scene.render()
    }

    function onDocumentKeyUp( event ) {
        switch ( event.keyCode ) {
        case 16: _isShiftDown = false; break;
        }
    }

    function onWindowResize() {
        Scene.camera.aspect = window.innerWidth / window.innerHeight;
        Scene.camera.updateProjectionMatrix();
        _renderer.setSize( window.innerWidth, window.innerHeight );
        _controls.handleResize();
        Scene.render();
    }

    function animate() {
        requestAnimationFrame( animate );
        _controls.update(); // use this too cause zooming's weird without it
        // Scene.render() // don't render on every frame unless you're really animating stuff
    }

    Scene.render = function(){
        try {
            _renderer.render(_scene, Scene.camera);
            _stats.update();
        } catch (e){
            msg.warning("Renderer not ready", 2)
        }
    }

    function createDirectionalLight(x, y, z){
        var directionalLight = new THREE.DirectionalLight(0xFFFB87);
        directionalLight.position.set(x, y, z);
        directionalLight.intensity = 0.75;
        directionalLight.castShadow = true;
        directionalLight.shadowDarkness = 0.2
        return directionalLight
    }

    return Scene
}())

var Game = (function(){
    var Game = {}

    Game.init = function(done){
        async.waterfall([
            function(done){
                Player.init(function(er){
                    done(er)
                })
            },
            function(done){
                Obj.init(function(er){
                    done(er)
                })
            },
            function(done){
                done(null)
                Scene.init()
            }
        ], function(er){
            if (er) H.log("ERROR. Game.init", er)
        })
    }

    // pos can have fractional values: round down to convert to game
    // coordinates
    Game.move = function(selected, pos){
        // REF. removing cube
        // Scene.getScene().remove( intersect.object );
        // Obj.getObjects().splice( Obj.getObjects().indexOf( intersect.object ), 1 );
        var x = Math.floor(pos.x)
        var y = Math.floor(pos.y)
        var z = Math.floor(pos.z)
        if (Move.isValidated(x, y, z)){
            Obj.move(selected, pos)
            Obj.highlight(selected, true)
            Highlight.hideAllHighlights()
            return true
        } else {
            msg.error("Invalid move")
            return false
        }
    }

    return Game
}())

window.onload = function(){
    if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

    Game.init()
}
