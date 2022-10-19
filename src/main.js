// monitoring
var stats = new Stats();
stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild( stats.dom );

// render context
const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

// threejs scene & global variables
const g_scene = new THREE.Scene();
var g_material;
var g_dynamicMaps=new Array();
var g_staticMap;
var g_framecount = 0;
var g_current_frame = 0;
var g_fps = 0
var g_clock = new THREE.Clock();
var g_delta_time = 0;

// camera controls
var g_camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
const g_cam_ctrl = new THREE.OrbitControls( g_camera, renderer.domElement );
g_camera.position.set(0, 0, 0);
g_camera.up.set(0, -1, 0);
g_cam_ctrl.update()
g_cam_ctrl.target = new THREE.Vector3(0, 0, 5);
g_cam_ctrl.enableDamping = true;
g_cam_ctrl.rotateSpeed *= -1;

// the UI
var gui = new dat.GUI();

const loader = new THREE.OBJLoader();
loader.load( '/VideoLoopUI/assets_test/geometry.obj', function ( obj ) {

    // The geometry
    var geometry = obj.children[0].geometry;

    // The material
    var material = new THREE.ShaderMaterial();
    material.extensions.derivatives = true;
    material.setValues({
        uniforms: THREE.UniformsUtils.merge([
            {
                dynamicMap: {}, staticMap: {},
            },
        ]), 
        vertexShader: document.getElementById('vertexShader').text,
        fragmentShader: document.getElementById('fragmentShader').text,
        wireframe: false,
        side: THREE.DoubleSide,
    });
    material.vertexColors = true;
    
    material.blending = THREE.CustomBlending;
    material.blendEquation = THREE.AddEquation;
    material.blendSrc = THREE.SrcAlphaFactor;
    material.blendDst = THREE.OneMinusSrcAlphaFactor;

    // The texture
    var textureLoader = new THREE.TextureLoader();
    g_staticMap = textureLoader.load("/VideoLoopUI/assets_test/static.png");
    
    var loader = new THREE.FileLoader();
    loader.load(
        "/VideoLoopUI/assets_test/meta.json",
        function ( data ) {
            // output the text to the console
            var cfg = JSON.parse(data)
            g_framecount = cfg.frame_count;
            g_fps = cfg.fps;

            for (var i = 0; i < g_framecount; i++)
            {
                var path = "/VideoLoopUI/assets_test/dynamic/" + i.toString().padStart(4, '0') + ".png"
                var dynamicMap = textureLoader.load(path);
                dynamicMap.minFilter = THREE.LinearFilter;
                g_dynamicMaps[i] = dynamicMap;
            }

        },
        function ( xhr ) { },
        function ( err ) {
            console.error( 'An error happened when load meta file' );
        }
    )
    
    g_staticMap.minFilter = THREE.LinearFilter;
    material.uniforms.staticMap.value = g_staticMap;
    
    g_material = material
    const mesh = new THREE.Mesh( geometry, material );
	g_scene.add(mesh);

}, undefined, function ( error ) {

	console.error( error );

} );


function animate() {
    requestAnimationFrame( animate );
    stats.begin();

    // whether to update the frame content
    g_delta_time += g_clock.getDelta();
    if (g_fps > 0 && g_delta_time > (1 / g_fps))
    {
        g_material.uniforms.dynamicMap.value = g_dynamicMaps[g_current_frame];
        g_current_frame += 1;
        if (g_current_frame >= g_framecount)
            g_current_frame = 0;
            
            g_delta_time = g_delta_time % (1 / g_fps);
    }
    g_cam_ctrl.update();
    renderer.setClearColor( 0x00000000, 0);
    renderer.render( g_scene, g_camera );
    stats.end();
};

animate();