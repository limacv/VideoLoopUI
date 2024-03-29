import * as THREE from "/VideoLoopUI/src/libs/three.module.js";
import {OrbitControls} from "/VideoLoopUI/src/libs/controls/OrbitControls.js";
import {OBJLoader} from "/VideoLoopUI/src/libs/loaders/OBJLoader.js";
import {VRButton} from "/VideoLoopUI/src/libs/webxr/VRButton.js"

// monitoring
var stats = new Stats();
stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild( stats.dom );

// read params
const querystr = window.location.search;
const urlparams = new URLSearchParams(querystr);
var defaultdata = "/VideoLoopUI/assets/fall5";
var use_vr = false;
if (urlparams.has("dataurl"))
    defaultdata = urlparams.get("dataurl");
if (urlparams.has("use_vr"))
    use_vr = true;

// render context
let renderer = new THREE.WebGLRenderer({alpha: false});
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );
if (use_vr)
{
    document.body.appendChild(VRButton.createButton( renderer ));
    renderer.xr.enabled = true;
}
THREE.ColorManagement.enabled = true;
// threejs scene & global variables
const PI = 3.1415926535;
const g_scene = new THREE.Scene();
var g_material;
var g_dynamicMaps=new Array();
var g_staticMap;
var g_isplay = true;
var g_isreverseplay = false;
var g_framecount = 0;
var g_current_frame = 0;
var g_clock = new THREE.Clock();
var g_delta_time = 0;
var g_x_limit = [0, PI * 2];
var g_y_limit = [0, PI];
var g_ctrl_params = {
    data_url: defaultdata,
    loadscene: function(){reset_scene(); load_scene();},

    fps: 0,
    play: function(){g_isplay = !g_isplay;},
    reverse: function(){g_isreverseplay = !g_isreverseplay;},
    speed: 0.01,
    panspeed: 0.02,
    zoomspeed: 0.02,
    reset: function(){g_cam_ctrl.reset();},

    x: 0,
    y: 0,
    z: 0,
    scale: 0,
};
var g_cfg;
var g_x_angle_last, g_y_angle_last;

if (use_vr)
{
    g_ctrl_params.z = 1.1;
    g_ctrl_params.scale = 2;
}

// camera controls
var g_camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.1, 1000 );
const g_cam_ctrl = new OrbitControls( g_camera, renderer.domElement );
g_camera.position.set(0, 0, 0);
g_cam_ctrl.update();
g_cam_ctrl.target = new THREE.Vector3(0, 0, 5);
g_cam_ctrl.enableDamping = true;
g_cam_ctrl.rotateSpeed = g_ctrl_params.speed;
g_cam_ctrl.panSpeed = g_ctrl_params.panspeed;
g_cam_ctrl.zoomSpeed = g_ctrl_params.zoomspeed;
g_cam_ctrl.screenSpacePanning = true;
g_cam_ctrl.saveState();

// the UI
var gui = new dat.GUI();
gui.add(g_ctrl_params, 'data_url')
gui.add(g_ctrl_params, 'loadscene')
var playctrl = gui.addFolder('Play Control');
playctrl.add(g_ctrl_params, 'play');
playctrl.add(g_ctrl_params, 'reverse');
playctrl.add(g_ctrl_params, 'fps', 0, 100).listen();
var viewctrl = gui.addFolder('View Control');
viewctrl.add(g_ctrl_params, 'reset');
viewctrl.add(g_ctrl_params, 'speed', 0, 0.1);
viewctrl.add(g_ctrl_params, 'panspeed', 0, 0.1);
viewctrl.add(g_ctrl_params, 'zoomspeed', 0, 0.1);
var meshctrl = gui.addFolder('Mesh Position');
meshctrl.add(g_ctrl_params, 'x', -8., 8.)
meshctrl.add(g_ctrl_params, 'y', -8., 8.)
meshctrl.add(g_ctrl_params, 'z', -8., 8.)
meshctrl.add(g_ctrl_params, 'scale', -8., 8.)

function reset_scene(){
    for( var i = g_scene.children.length - 1; i >= 0; i--) { 
        g_scene.remove(g_scene.children[i]); 
    }
    g_dynamicMaps=[];
    g_framecount = 0;
    g_ctrl_params.fps = 0;
}

function onWindowResize() {
    g_camera.aspect = window.innerWidth / window.innerHeight;
    if (window.innerWidth / window.innerHeight < 16 / 9)
        g_camera.fov = g_cfg.fov;
    else
        g_camera.fov = g_cfg.fov / (window.innerWidth / window.innerHeight) * (16 / 9);
    g_camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
}
window.addEventListener("resize", onWindowResize)

const loader = new OBJLoader();
function load_scene(){
    loader.load( g_ctrl_params.data_url + '/geometry.obj', function ( obj ) {
    
        // The geometry
        var geometry = obj.children[0].geometry;
        geometry.rotateX(PI);
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
        material.blendSrcAlpha = THREE.OneFactor;
    
        // The texture
        var textureLoader = new THREE.TextureLoader();
        g_staticMap = textureLoader.load(g_ctrl_params.data_url + "/static.png");
        
        var loader = new THREE.FileLoader();
        loader.load(
            g_ctrl_params.data_url + "/meta.json",
            function ( data ) {
                // output the text to the console
                g_cfg = JSON.parse(data)
                g_framecount = g_cfg.frame_count;
                g_ctrl_params.fps = g_cfg.fps;

                // setting camera
                if (window.innerWidth / window.innerHeight < 16 / 9)
                    g_camera.fov = g_cfg.fov;
                else
                    g_camera.fov = g_cfg.fov / (window.innerWidth / window.innerHeight) * (16 / 9);
                // g_camera.aspect = window.innerWidth / window.innerHeight;
                g_camera.position.set(0, 0, 0);
                g_camera.updateProjectionMatrix()
                g_cam_ctrl.target.set(g_cfg.lookat[0], -g_cfg.lookat[1], -g_cfg.lookat[2]);
                
                const x_limit = g_cfg.limit[0] / g_cfg.lookat[2];
                const y_limit = g_cfg.limit[1] / g_cfg.lookat[2];
                g_cam_ctrl.update();
                g_cam_ctrl.saveState();
                const clamp = (num, min, max) => Math.min(Math.max(num, min), max);
                var x_angle = g_cam_ctrl.getAzimuthalAngle();
                x_angle = x_angle < 0 ? x_angle + 2 * PI : x_angle;
                let y_angle = g_cam_ctrl.getPolarAngle();
                g_x_limit[0] = clamp(x_angle - x_limit, 0, PI * 2);
                g_x_limit[1] = clamp(x_angle + x_limit, 0, PI * 2);
                g_y_limit[0] = clamp(y_angle - y_limit, 0, PI);
                g_y_limit[1] = clamp(y_angle + y_limit, 0, PI);
    
                for (var i = 0; i < g_framecount; i++)
                {
                    var path = g_ctrl_params.data_url + "/dynamic/" + i.toString().padStart(4, '0') + ".png"
                    var dynamicMap = textureLoader.load(path);
                    dynamicMap.minFilter = THREE.LinearFilter;
                    g_dynamicMaps[i] = dynamicMap;
                }
    
            },
            function ( xhr ) { },
            function ( err ) {
                console.error( 'An error happened when load meta file' );
                alert('Oops! Fail to load meta file');
            }
        )
        g_staticMap.generateMipmaps = false;
        g_staticMap.minFilter = THREE.LinearFilter;
        material.uniforms.staticMap.value = g_staticMap;
        
        g_material = material;
        var mesh = new THREE.Mesh( geometry, material );
        g_scene.add(mesh);
    
    }, undefined, function ( error ) {
    
        console.error( error );
        alert('Oops! Fail to load data');
    } );
}

function animate() {
    renderer.setAnimationLoop(
        function ()
        {
            stats.begin();

            // whether to update the frame content
            g_delta_time += g_clock.getDelta();
            if (g_isplay && g_ctrl_params.fps > 0 && g_delta_time > (1 / g_ctrl_params.fps))
            {
                g_material.uniforms.dynamicMap.value = g_dynamicMaps[g_current_frame];
                var step = g_isreverseplay ? -1 : 1;
                g_current_frame += step;
                g_current_frame = g_current_frame >= g_framecount ? 0 : (g_current_frame < 0 ? g_framecount - 1: g_current_frame);
                    
                g_delta_time = g_delta_time % (1 / g_ctrl_params.fps);
            }
            // update speed to add limit
            var x_angle = g_cam_ctrl.getAzimuthalAngle();
            x_angle = x_angle < 0 ? x_angle + 2 * PI : x_angle;
            var y_angle = g_cam_ctrl.getPolarAngle();

            // if ((x_angle < g_x_limit[0] && x_angle - g_x_angle_last < 0)
            //      || (x_angle > g_x_limit[1] && x_angle - g_x_angle_last > 0)
            //      || (y_angle < g_y_limit[0] && y_angle - g_y_angle_last < 0) 
            //      || (y_angle > g_y_limit[1] && y_angle - g_y_angle_last > 0))
            //     g_cam_ctrl.rotateSpeed = g_view_params.speed * 0.1;
            // else
            g_cam_ctrl.rotateSpeed = g_ctrl_params.speed;
            g_cam_ctrl.panSpeed = g_ctrl_params.panspeed;
            g_cam_ctrl.zoomSpeed = g_ctrl_params.zoomspeed;

            g_x_angle_last = x_angle;
            g_y_angle_last = y_angle;
            // var deltax = Math.min(Math.abs(x_angle - g_x_limit[0]), Math.abs(x_angle - g_x_limit[1])) / (g_x_limit[1] - g_x_limit[0]) * 2;
            // var deltay = Math.min(Math.abs(y_angle - g_y_limit[0]), Math.abs(y_angle - g_y_limit[1])) / (g_y_limit[1] - g_y_limit[0]) * 2;
            // var delta = Math.sqrt(deltax * deltax + deltay * deltay) / Math.sqrt(2);
            // var speed_scale = delta;
            // g_cam_ctrl.rotateSpeed = g_view_params.speed * speed_scale;
            // console.log(g_cam_ctrl.rotateSpeed)

            g_cam_ctrl.update();
            var mesh = g_scene.children[0];
            if (mesh)
            {
                mesh.position.set(g_ctrl_params.x, g_ctrl_params.y, g_ctrl_params.z);
                var scale = Math.pow(2, g_ctrl_params.scale);
                mesh.scale.set(scale, scale, scale);
            }
            renderer.render( g_scene, g_camera );
            renderer.setClearColor( 0x000000, 1);
            stats.end();
        }
    );
};

gui.close();
load_scene();
animate();