/**
 * Created by gautier on 16/06/2014.
 */

var container, stats;

var camera, scene, renderer, controls, boundingbox, sceneRadiusForCamera, plinth, cubeMaterial, objectCopy;

var size = new Array();

var mouseX = 0, mouseY = 0;

var windowHalfX = window.innerWidth / 2;
var windowHalfY = window.innerHeight / 2;

init();
animate();

function buildAxes( length ) {
    var axes = new THREE.Object3D();

    axes.add( buildAxis( new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( length, 0, 0 ), 0xFF0000, false ) ); // +X
    axes.add( buildAxis( new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( -length, 0, 0 ), 0xFF0000, true) ); // -X
    axes.add( buildAxis( new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 0, length, 0 ), 0x00FF00, false ) ); // +Y
    axes.add( buildAxis( new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 0, -length, 0 ), 0x00FF00, true ) ); // -Y
    axes.add( buildAxis( new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 0, 0, length ), 0x0000FF, false ) ); // +Z
    axes.add( buildAxis( new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 0, 0, -length ), 0x0000FF, true ) ); // -Z

    return axes;

}
function buildAxis( src, dst, colorHex, dashed ) {
    var geom = new THREE.Geometry(),
        mat;

    if(dashed) {
        mat = new THREE.LineDashedMaterial({ linewidth: 3, color: colorHex, dashSize: 3, gapSize: 3 });
    } else {
        mat = new THREE.LineBasicMaterial({ linewidth: 3, color: colorHex });
    }

    geom.vertices.push( src.clone() );
    geom.vertices.push( dst.clone() );
    geom.computeLineDistances(); // This one is SUPER important, otherwise dashed lines will appear as simple plain lines

    var axis = new THREE.Line( geom, mat, THREE.LinePieces );

    return axis;

}

function init() {

    if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

    container = document.createElement( 'div' );
    document.body.appendChild( container );

    renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setSize( window.innerWidth, window.innerHeight );

    scene = new THREE.Scene();

    // Add axes
    axes = buildAxes( 1000 );

    camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 2000 );

    controls = new THREE.TrackballControls( camera );

    controls.rotateSpeed = 1.0;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.2;
    controls.noZoom = false;
    controls.noPan = false;
    controls.staticMoving = false;
    controls.dynamicDampingFactor = 0.3;
    controls.minDistance = 1.1;
    controls.maxDistance = 100;

    controls.keys = [ 65, 83, 68 ]; // [ rotateKey, zoomKey, panKey ]

    var ambient = new THREE.AmbientLight( 0xaaaaaa );
    scene.add( ambient );

    var frontLight = new THREE.DirectionalLight( 0xffeedd );
    frontLight.position.set( 1, 1, 0.5 ).normalize();
    scene.add( frontLight );

    var backLight = new THREE.DirectionalLight( 0xffeedd );
    backLight.position.set( -1, -1, 0.5 ).normalize();
    scene.add( backLight );

    var callbackProgress = function( progress, result ) {
        console.log (progress);
/*
        var bar = 250,
            total = progress.totalModels + progress.totalTextures,
            loaded = progress.loadedModels + progress.loadedTextures;

        if ( total )
            bar = Math.floor( bar * loaded / total );

        $("bar" ).style.width = bar + "px";

        count = 0;
        for ( var m in result.materials ) count++;

        handle_update( result, Math.floor( count/total ) );
*/
    }
    var callbackFinished = function ( result ) {
        loaded = result;
        handle_update( result, 1 );

    }


    // model
    var loader = new THREE.OBJMTLLoader();
    loader.callbackProgress = callbackProgress();
    loader.callbackSync = callbackProgress();

    var onLoad = function(object) {

        var zAxis = new THREE.Vector3(1,0,0);
        var xAxis = new THREE.Vector3(0,1,0);

        // Rotation on X Axis to reflect front face as shown in Meshlab
        object.rotateOnAxis(xAxis, 90 * Math.PI/180);

        object.rotateOnAxis(zAxis, -90 * Math.PI/180);


        scene.add( object );

        boundingbox = new THREE.BoundingBoxHelper(object, 0xff0000);
        boundingbox.update();

        // If you just want the numbers
        console.log(boundingbox.box.min);
        console.log(boundingbox.box.max);

        // Centering object on scene center : moving Z to half eight down
        boundingbox.update();

        size.x = boundingbox.box.max.x - boundingbox.box.min.x;
        size.y = boundingbox.box.max.y - boundingbox.box.min.y;
        size.z = boundingbox.box.max.z - boundingbox.box.min.z;

        // Repositioning object
        object.position.x = -boundingbox.box.min.x - size.x/2;
        object.position.y = -boundingbox.box.min.y - size.y/2;
        object.position.z = -boundingbox.box.min.z - size.z/2;

        boundingbox.update();

        sceneRadiusForCamera = Math.max(
            boundingbox.box.max.y - boundingbox.box.min.y,
            boundingbox.box.max.z - boundingbox.box.min.z,
            boundingbox.box.max.x - boundingbox.box.min.x
        )/2 * (1 + Math.sqrt(5)) ; // golden number to beautify display

        console.log(sceneRadiusForCamera);

        showFront();

        jQuery("#progress").css("display", "none");

        objectCopy = object;
    }

    var onProgress = function(object) {
        var progression = (object.position / object.totalSize) * 100;
        jQuery("#progress").progressbar({
            value: progression
        });

        console.log(object.totalSize + " " + object.position + " " + progression);
    }

    var loadFunctionBackup = loader.load;

    // Overwriting OBJMTLLoader to allow progression monitoring
    loader.load = function ( url, mtlurl, onLoad, onProgress, onError ) {

        var scope = this;


        // Modif GM : transmiting function parameters to avoid using a defaultLoadingManager
        //scope.manager = new THREE.LoadingManager(onLoad,onProgress,onError);
        // End modif GM

        var mtlLoader = new THREE.MTLLoader( url.substr( 0, url.lastIndexOf( "/" ) + 1 ) );
        mtlLoader.load( mtlurl, function ( materials ) {

            var materialsCreator = materials;
            materialsCreator.preload();

            var loader = new THREE.XHRLoader( scope.manager );
            loader.setCrossOrigin( this.crossOrigin );
            loader.load( url, function ( text ) {

                var object = scope.parse( text );

                object.traverse( function ( object ) {

                    if ( object instanceof THREE.Mesh ) {

                        if ( object.material.name ) {

                            var material = materialsCreator.create( object.material.name );

                            if ( material ) object.material = material;

                        }

                    }

                } );

                onLoad( object );

            }, onProgress, onError );

        } );

    }


    /*___________________________________________________________________________

        OBJECT LOADING
      ___________________________________________________________________________
     */
    //loader.load( 'examples/rivergod/mesh.obj', 'examples/rivergod/mesh.mtl', onLoad, onProgress);
    //loader.load( 'examples/santiago/Item.obj', 'examples/santiago/Item_Name_tex.mtl', onLoad, onProgress);
    loader.load( 'examples/cow.obj', 'examples/cow.obj.mtl', onLoad, onProgress);
    //loader.load( 'examples/mask/mesh.obj', 'examples/mask/tex.mtl', onLoad, onProgress);


    container.appendChild( renderer.domElement );
    document.addEventListener( 'mousemove', onDocumentMouseMove, false );
    window.addEventListener( 'resize', onWindowResize, false );

    camera.lookAt(new THREE.Vector3(0,-1,0));
    console.log(camera);
}

function onWindowResize() {
}

function onDocumentMouseMove( event ) {
}

function addPlinth() {
    // Calculating plinth only if button toggled for performance issue
    if(plinth === undefined) {
        cubeMaterial = new THREE.MeshPhongMaterial( { ambient: 0x030303, color: 0x222222, specular: 0x000512, shininess: 10, shading: THREE.FlatShading } );
        //cubeMaterial.opacity = 0.6;
        //cubeMaterial.transparent = true;
        plinth = new THREE.Mesh( new THREE.BoxGeometry(
            (size.x),
            (size.y),
            (size.z)
        ), cubeMaterial );
        console.log(plinth);
        boundingbox.update();
        //scene.addObject( plinth );
        //plinth.computeBoundingBox();
        plinth.position.y = boundingbox.box.min.y * 2;
        plinth.name = "plinth";
    }
    if(!scene.getObjectByName( 'plinth', true )) {
        //Adding plinth to scene if not already there
        scene.add(plinth);
    }
}
function removePlinth() {
    scene.remove(plinth);
}

/*  ___________________________________________________________________________

    Object Views
    ___________________________________________________________________________
*/

function showLeft() {
    controls.reset();
    camera.position.y = 0;
    camera.position.x = 0;
    camera.position.z = sceneRadiusForCamera;
    camera.lookAt(scene.position);
}

function showRight() {
    controls.reset();
    camera.position.y = 0;
    camera.position.x = 0;
    camera.position.z = -sceneRadiusForCamera;
    camera.lookAt(scene.position);
}

function showBack() {
    controls.reset();
    camera.position.z = 0;
    camera.position.y = 0;
    camera.position.x = -sceneRadiusForCamera;
    camera.lookAt(scene.position);
}

function showFront() {
    controls.reset();
    camera.position.z = 0;
    camera.position.y = 0;
    camera.position.x = sceneRadiusForCamera;
    camera.lookAt(scene.position);
}

function showTop(){
    controls.reset();
    camera.position.x = 0;
    camera.position.z = 0;
    camera.position.y = sceneRadiusForCamera;
    camera.lookAt(scene.position);
}

function showBottom(){
    controls.reset();
    camera.position.x = 0;
    camera.position.z = 0;
    camera.position.y = -sceneRadiusForCamera;
    camera.lookAt(scene.position);
}

/*  ___________________________________________________________________________

    Object translation
    ___________________________________________________________________________
 */

function translateRight(){
    objectCopy.translateX(1);
}

function translateLeft(){
    objectCopy.translateX(-1);
}

function translateUp(){
    objectCopy.translateZ(1);
}

function translateDown(){
    objectCopy.translateZ(-1);
}

/*  ___________________________________________________________________________

    Zoom
    ___________________________________________________________________________
 */

function zoomIn(){
    camera.translateZ(-1);
}

function zoomOut(){
    camera.translateZ(1);
}



function animate() {
    requestAnimationFrame( animate );
    render();
}

function render() {
    //console.log(scene.position);
    //controls.target(cameraTarget);
    controls.update(); //for cameras
    renderer.render( scene, camera );
}

function buildAxes( length ) {
    var axes = new THREE.Object3D();

    axes.add( buildAxis( new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( length, 0, 0 ), 0xFF0000, false ) ); // +X
    axes.add( buildAxis( new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( -length, 0, 0 ), 0xFF0000, true) ); // -X
    axes.add( buildAxis( new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 0, length, 0 ), 0x00FF00, false ) ); // +Y
    axes.add( buildAxis( new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 0, -length, 0 ), 0x00FF00, true ) ); // -Y
    axes.add( buildAxis( new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 0, 0, length ), 0x0000FF, false ) ); // +Z
    axes.add( buildAxis( new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 0, 0, -length ), 0x0000FF, true ) ); // -Z

    return axes;

}

function buildAxis( src, dst, colorHex, dashed ) {
    var geom = new THREE.Geometry(),
        mat;

    if(dashed) {
        mat = new THREE.LineDashedMaterial({ linewidth: 3, color: colorHex, dashSize: 3, gapSize: 3 });
    } else {
        mat = new THREE.LineBasicMaterial({ linewidth: 3, color: colorHex });
    }

    geom.vertices.push( src.clone() );
    geom.vertices.push( dst.clone() );
    geom.computeLineDistances(); // This one is SUPER important, otherwise dashed lines will appear as simple plain lines

    var axis = new THREE.Line( geom, mat, THREE.LinePieces );

    return axis;

}

jQuery(document).ready(function() {
    jQuery(".buttons-detail").hide();
    jQuery(".buttons-header").click(function() {
        jQuery(this).parent().find(".buttons-detail").slideToggle();
    });
    jQuery("#face-buttons .buttons-detail").show();

});