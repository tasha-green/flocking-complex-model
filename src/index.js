import * as THREE from "/libs/three.module.js";
import { GLTFLoader } from "/libs/GLTFLoader.js";
import * as SkeletonUtils from "/libs/SkeletonUtils.js";
import { GUI } from "/libs/lil-gui.module.min.js";
import Stats from "/libs/stats.module.js";

/* Done:
*  Simple lighting
*  Set up scene
*  Orbit controls
*  Change speed of animations
*  symplectic euler
*  Place a few blocks in scene
*  k-th nearest neighbours
*/

let camera, scene, renderer;
let clock, container, stats;


const mixers = [];
const models = [];
const obstacles = [];

const M = 4;
let neighbours = [];

const p = 20;
const d = 30;

const r = 90;

const g = -9.8;

const epsilon = 0.01;

const threeModel = {
    Gravity: true,
    C_rep: 0.1,
    C_att: 0.1,
    C_ali: 0.1
}


const particleInfo = [];
// pos_0 = vector
// pos = vector
// vel_0 = vector
// vel = vector
// leader = bool - false if follower
// leaderTime = 0.0
// refractory time = 0.0
// mass = 2.0

init();
animate();

function initGUI() {
    const gui = new GUI();

    gui.add(threeModel, 'Gravity');
    gui.add(threeModel, 'C_rep', 0, 100)
        .name('Repulsion');
    gui.add(threeModel, 'C_att', 0, 100)
        .name('Attraction');
    gui.add(threeModel, 'C_ali', 0, 100)
        .name('Alignment');

}

function init() {
    // Set up camera
    camera = new THREE.PerspectiveCamera(100, window.innerWidth / window.innerHeight, 0.25, 500);
    camera.position.set(0, 80, -20);
    //camera.position.set(40, 30, 119);
    camera.rotation.set(0, Math.PI, 0);

    container = document.createElement("div");
    document.body.appendChild(container);

    // Set up basic scene
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe0e0e0);
    scene.fog = new THREE.Fog(0xe0e0e0, 30, 150);

    /*const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshPhongMaterial({ 
        color: 0x339933, 
        depthWrite: false
    }));*/

    initGUI();

    // Obstacles
    
    const obstacleGeo_1 = new THREE.BoxGeometry( 10, 250, 10);
    const obstacleGeo_2 = new THREE.BoxGeometry( 10, 190, 10);


    const obstacle_mesh = new THREE.MeshLambertMaterial( {
        color: 0x333333
    } );

    const obstacle_1 = new THREE.Mesh( obstacleGeo_1, obstacle_mesh);
    const obstacle_2 = new THREE.Mesh( obstacleGeo_1, obstacle_mesh);

    const obstacle_3 = new THREE.Mesh( obstacleGeo_2, obstacle_mesh);
    const obstacle_4 = new THREE.Mesh( obstacleGeo_2, obstacle_mesh);


    placeObstacle(obstacle_1, 75, 10, 80);
    placeObstacle(obstacle_2, -45, 10, 90);

    placeObstacle(obstacle_3, -48, 5, 50);
    placeObstacle(obstacle_4, 0, 5, 25);

    obstacles.push(obstacle_1, obstacle_2, obstacle_3, obstacle_4);

    // Wall boundaries
    const wallGeo = new THREE.BoxGeometry(400, 600, 5);
    const wallMesh = new THREE.MeshLambertMaterial( {
        color: 0xe0e0e0
    });

    const wall_1 = new THREE.Mesh(wallGeo, wallMesh);
    const wall_2 = new THREE.Mesh(wallGeo, wallMesh);
    const wall_3 = new THREE.Mesh(wallGeo, wallMesh);
    const wall_4 = new THREE.Mesh(wallGeo, wallMesh);


    placeObstacle(wall_1, 0, 100, -200);
    placeObstacle(wall_2, 200, 100, 0);
    wall_2.rotation.y = -Math.PI / 2;

    placeObstacle(wall_3, -200, 100, 0);
    wall_3.rotation.y = -Math.PI / 2;
    placeObstacle(wall_4, 0, 100, 200);

    obstacles.push(wall_1, wall_2, wall_3, wall_4);

    scene.add(wall_1);
    scene.add(wall_2);
    scene.add(wall_3);
    scene.add(wall_4);

    scene.add( obstacle_1 );
    scene.add( obstacle_2 );

    scene.add( obstacle_3 );
    scene.add( obstacle_4 );
    

    // Ground's facing the wrong way
    //ground.rotation.x = -Math.PI / 2;
    
    //scene.add(ground);

    clock = new THREE.Clock();

    //const grid = new THREE.GridHelper(400, 100, 0x003300, 0x003300);
    //scene.add(grid);

    
    new GLTFLoader().load("/bird-metallic1.glb", function(gltf) {
        gltf.scene.scale.set(1.5, 1.5, 1.5);

        for(let i = 0; i < 50; i++) {

            let model = SkeletonUtils.clone(gltf.scene);

            let mixer = new THREE.AnimationMixer(model);

            let animation = mixer.clipAction(gltf.animations[0]);

            // Set initial positions
            model.position.x = THREE.MathUtils.randFloat(0, 100);
            model.position.y = THREE.MathUtils.randFloat(30, 70);
            model.position.z = THREE.MathUtils.randFloat(30, 60);

            // Set initial velocity            
            let vel_0x = THREE.MathUtils.randFloat(5, 10);
            let vel_0y = THREE.MathUtils.randFloat(5, 10);
            let vel_0z = THREE.MathUtils.randFloat(10, 25);

            // Change wing animation speed
            if(vel_0z > 23) {
                mixer.timeScale = 6;
            }
            else if(20 < vel_0z <= 23) {
                mixer.timeScale = 5;
            }
            else if( 18 < vel_0z <= 20) {
                mixer.timeScale = 4;
            }
            else if(15 < vel_0z <= 18) {
                mixer.timeScale = 3;
            }
            else {
                mixer.timeScale = 2;
            }

            animation.play();

            scene.add(model);

            models.push(model);
            mixers.push(mixer);

            // select four random indexes to be leaders
            let index_1 = THREE.MathUtils.randInt(0, 49);
            let index_2 = THREE.MathUtils.randInt(0, 49);
            let index_3 = THREE.MathUtils.randInt(0, 49);
            let index_4 = THREE.MathUtils.randInt(0, 49);

            if (i == index_1 || i == index_2 || i == index_3 || i == index_4) {
                particleInfo.push({
                    pos_0: new THREE.Vector3(model.position.x, model.position.y, model.position.z),
                    pos: new THREE.Vector3(model.position.x, model.position.y, model.position.z),
                    vel_0: new THREE.Vector3(vel_0x, vel_0y, vel_0z),
                    vel: new THREE.Vector3(vel_0x, vel_0y, vel_0z),
                    leader: true,
                    leaderTime: clock.elapsedTime,
                    refractory: 0,
                    mass: 0.5
                });
            }
            else {
                particleInfo.push({
                    pos_0: new THREE.Vector3(model.position.x, model.position.y, model.position.z),
                    pos: new THREE.Vector3(model.position.x, model.position.y, model.position.z),
                    vel_0: new THREE.Vector3(vel_0x, vel_0y, vel_0z),
                    vel: new THREE.Vector3(vel_0x, vel_0y, vel_0z),
                    leader: false,
                    leaderTime: 0,
                    refractory: 0,
                    mass: 0.5
                });
            }
            
            document.getElementById( 'loader' ).style.display = 'none';
        }
        
    }); 

    // Set up renderer
    renderer = new THREE.WebGLRenderer();
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    document.body.appendChild(renderer.domElement);

    stats = new Stats();
    container.appendChild(stats.dom);

    // Window resize
    window.addEventListener('resize', onWindowResize, false);
}

function placeObstacle(object, x, y, z) {
    object.position.x = x;
    object.position.y = y;
    object.position.z = z;
}

function distanceBetween(particle, neighbour) {
    let d = particle.distanceTo(neighbour);

    return d;
}

function attractiveForce(X_i, X_j) {
    let sub = new THREE.Vector3();
    sub = sub.subVectors(X_j, X_i);
    return sub;
}

function repulsiveForce(X_i, X_j) {
    let sub = new THREE.Vector3();
    let a = new THREE.Vector3();

    sub = sub.subVectors(X_j, X_i);

    
    let denominator = Math.abs(Math.pow((X_j.x - X_i.x), 2) + Math.pow((X_j.y - X_i.y), 2) + Math.pow((X_j.z - X_i.z), 2)) + epsilon;

    a = sub.divideScalar(denominator);

    return a;
}

function alignmentForce(V_i, V_j) {
    let sub = new THREE.Vector3();
    sub = sub.subVectors(V_j, V_i);
    return sub;
}

function animate() {
    requestAnimationFrame(animate);

    const dt = clock.getDelta();

    for ( const mixer of mixers ) {
        
        mixer.update( dt );
    }

    // For each model
    for(let i = 0; i < models.length; i++) {
        let model = models[i];
        let particle = particleInfo[i];

        let particlePos = new THREE.Vector3(particle.pos_0.x, particle.pos_0.y, particle.pos_0.z);

        // Nearest neighbours search
        for(let k = 0; k < models.length; k++) {
            if(i == k) {
                continue;
            }
            else {
                // calculate distance between
                let neighbour = particleInfo[k];
                let neighbourPos = new THREE.Vector3(neighbour.pos_0.x, neighbour.pos_0.y, neighbour.pos_0.z);
                let neighbourVel = new THREE.Vector3(neighbour.vel_0.x, neighbour.vel_0.y, neighbour.vel_0.z);

                let distance = distanceBetween(particlePos, neighbourPos);

                // if array isn't full
                if (neighbours.length < M) {
                    neighbours.push({
                        pos_0: new THREE.Vector3(neighbourPos.x, neighbourPos.y, neighbourPos.z),
                        vel_0: new THREE.Vector3(neighbourVel.x, neighbourVel.y, neighbourVel.z),
                        distance: distance, 
                        index: k
                    });
                }
                else {
                    // compare the distance to each of the neighbours
                    for(let n = 0; n < M; n++) {
                        if (distance < neighbours[n].distance) {
                            // Replace
                            neighbours[n].pos_0 = neighbourPos;
                            neighbours[n].vel_0 = neighbourVel;
                            neighbours[n].distance = distance;
                            neighbours[n].index = k;
                        }
                        // Edge case
                        else if(distance == neighbours[n].distance) {
                            if(k < neighbours[n].k) {
                                neighbours[n].pos_0 = neighbourPos;
                                neighbours[n].vel_0 = neighbourVel;
                                neighbours[n].distance = distance;
                                neighbours[n].index = k;
                            }
                        }
                    }
                    
                }
            }
        }

        // Sort neighbour array by distance - [1]
        neighbours.sort(function(a, b) {
            return a[1] - b[1]
        });

        // if leader
        if (particle.leader == true) {

            let t = clock.elapsedTime - particle.leaderTime;

            // check if it flips from leader to follower
            if( t > p || neighbours[0].distance > d) {
                // Make the leader a follower
                particle.leader = false;
                // Set refractory time
                particle.refractory = clock.elapsedTime + r;
                // Reset leaderTime
                particle.leaderTime = 0.0;

                // Choose another leader
                let foundLeader = false;

                while(foundLeader == false) {
                    let leaderIndex = THREE.MathUtils.randInt(0, 49);

                    if(particleInfo[leaderIndex].leader == false) {

                        if(particleInfo[leaderIndex].refractory == 0) {
                            particleInfo[leaderIndex].leader = true;
                            particleInfo[leaderIndex].leaderTime = clock.elapsedTime;
                            foundLeader = true;
                        }
                        else {
                            if(particleInfo[leaderIndex].refractory <= clock.elapsedTime) {
                                particleInfo[leaderIndex].leader = true;
                                particleInfo[leaderIndex].leaderTime = clock.elapsedTime;
                                particleInfo[leaderIndex].refractory = 0
                                foundLeader = true;
                            }
                        }
                    }
                }
            }
        }

        // Calculate Repulsive Force
        let sumRep = new THREE.Vector3();
        let f_rep = new THREE.Vector3();

        // Calculate Attraction Force
        let sumAtt = new THREE.Vector3();
        let f_att = new THREE.Vector3();

        // Calculate Alignment Force
        let sumAli = new THREE.Vector3();
        let f_ali = new THREE.Vector3();

        let sumSteer = new THREE.Vector3();
        let f_steer = new THREE.Vector3();
        

        // Force of gravity
        let f_g;

        if(threeModel.Gravity == true) {
            f_g = new THREE.Vector3(0, particle.mass * g, 0);
        }
        else {
            f_g = new THREE.Vector3(0, 0, 0);
        }

        // Given Neighbours calculate Rep, Ali & Att forces
        for(let j = 0; j < neighbours.length; j++) {
            
            let curr = neighbours[j];

            let X_j = new THREE.Vector3(curr.pos_0.x, curr.pos_0.y, curr.pos_0.z);
            let X_i = new THREE.Vector3(particle.pos_0.x, particle.pos_0.y, particle.pos_0.z);

            let V_j = new THREE.Vector3(curr.vel_0.x, curr.vel_0.y, curr.vel_0.z);
            let V_i = new THREE.Vector3(particle.vel_0.x, particle.vel_0.y, particle.vel_0.z);

            sumAtt = sumAtt.addVectors(sumAtt, attractiveForce(X_i, X_j));
            sumRep = sumRep.addVectors(sumRep, repulsiveForce(X_i, X_j));
            sumAli = sumAli.addVectors(sumAli, alignmentForce(V_i, V_j));
        }

        f_rep = sumRep;
        f_rep = f_rep.multiplyScalar(-threeModel.C_rep);
        f_rep = f_rep.multiplyScalar(2.5);

        f_att = sumAtt;
        f_att = f_att.multiplyScalar(threeModel.C_att);
        f_att = f_att.multiplyScalar(0.5);

        f_ali = sumAli;
        f_ali = f_ali.multiplyScalar(threeModel.C_ali / M);
        f_att = f_att.multiplyScalar(1.0);
        
        // Is it close to any of are obstacles?
        for(let ob = 0; ob < obstacles.length; ob++) {

            let xis = new THREE.Vector3();
            xis = xis.subVectors(obstacles[ob].position, particlePos);

            let norm_vel_0 = particle.vel_0.normalize();
            let sc = norm_vel_0.dot(xis);

            if(sc >= 0) {
                // obstacle's not behind
                let tc = 12.00;
                let dc = particle.vel_0.length() * tc;

                if (sc <= dc) {
                    // point of closest approach
                    let xc = new THREE.Vector3();
                    xc = xc.addVectors(particlePos, norm_vel_0.multiplyScalar(sc));

                    let d = xc.distanceTo(obstacles[ob].position);

                    if(d <= 20) {
                        // calculate a
                        let vel_0_ortho = new THREE.Vector3();
                        vel_0_ortho = vel_0_ortho.subVectors(xc, obstacles[ob].position);

                        let norm_vel_0_ortho = vel_0_ortho.normalize();

                        let xt = new THREE.Vector3();
                        xt = xt.addVectors(obstacles[ob].position, norm_vel_0_ortho.multiplyScalar(5));

                        let d_t = xt.distanceTo(particlePos);

                        let x_d = new THREE.Vector3();
                        x_d = x_d.subVectors(xt, particlePos);

                        let v_t = (particle.vel_0).dot(x_d.divideScalar(d_t));
                        let t_t = d_t/v_t;

                        let avg_v_s = (norm_vel_0_ortho.cross(x_d)).length()/ t_t;

                        let steer = norm_vel_0_ortho.multiplyScalar((4*avg_v_s)/t_t)
                        sumSteer = sumSteer.addVectors(sumSteer, steer);
                    }
                }
            }
            
        }

        f_steer = sumSteer;

        let f_app = new THREE.Vector3(0, 0, 10);

        let forces = new THREE.Vector3();
        
        if(particle.leader == true) {
            forces = forces.addVectors(f_rep, f_g);
            forces = forces.addVectors(forces, f_steer);
            forces = forces.addVectors(forces, f_app);

        }
        else {
            forces = forces.addVectors(f_rep, f_att);
            forces = forces.addVectors(forces, f_g);
            forces = forces.addVectors(forces, f_ali);
            forces = forces.addVectors(forces, f_app);
            forces = forces.addVectors(forces, f_steer);
        }

        let a = forces.divideScalar(particle.mass);

        //let a = forces;
        // Symplectic Euler
        particle.vel.x = particle.vel_0.x + dt * a.x;
        particle.vel.y = particle.vel_0.y + dt * a.y;
        particle.vel.z = particle.vel_0.z + dt * a.z;

        // is my new velocity bigger than max velocity? clamp
        if(particle.vel.x > 20) {
            particle.vel.x = 20;
        }
        
        if(particle.vel.y > 20) {
            particle.vel.y = 20;
        }

        if(particle.vel.z > 20) {
            particle.vel.z = 20;
        }

        particle.pos.x = particle.pos_0.x + dt * particle.vel.x;
        particle.pos.y = particle.pos_0.y + dt * particle.vel.y;
        particle.pos.z = particle.pos_0.z + dt * particle.vel.z;

        if(particle.pos.z < 0|| particle.pos.z > 50) {
            particle.pos.z = THREE.MathUtils.clamp(particle.pos.z, 0, 50);
            particle.vel.z = -particle.vel.z;
            
        }
        if(particle.pos.x < -200 || particle.pos.x > 200) {
            particle.pos.x = THREE.MathUtils.clamp(particle.pos.z, -200, 200);
            particle.vel.x = -particle.vel.x;
        }
        if(particle.pos.y < -200 || particle.pos.y > 200) {
            particle.pos.y = THREE.MathUtils.clamp(particle.pos.y, -200, 200);
            particle.vel.y = -particle.vel.y;
        }

        model.position.x = particle.pos.x;
        model.position.y = particle.pos.y;
        model.position.z = particle.pos.z;

        //model.rotation.x += particle.vel.x * 4 * dt;
        //model.rotation.y += particle.vel.y * 4 * dt;
        //model.rotation.z += particle.vel.z * 4 * dt;

        model.lookAt(particle.pos);
    }

    for(const particle of particleInfo) {
        particle.pos_0 = particle.pos;
        particle.vel_0 = particle.vel;
    }

    renderer.render(scene, camera);

    stats.update();
}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

