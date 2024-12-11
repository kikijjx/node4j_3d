import * as THREE from 'three';
import axios from 'axios';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import pLimit from 'p-limit';

let scene, camera, renderer, controls, raycaster, mouse, intersects;
let nodes = [];
let links = [];
let selectedNode = null;

const nodeRadius = 0.2;


async function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    try {
        const { data: nodesData } = await axios.get('http://localhost:8000/nodes');

        const limit = pLimit(10);
        const nodesWithRelations = await Promise.all(
            nodesData.map((node) =>
                limit(async () => {
                    const { data: fullNode } = await axios.get(`http://localhost:8000/node/${node.label}/${node.id}`);
                    return fullNode;
                })
            )
        );

        createNodesAndLinks(nodesWithRelations);
    } catch (error) {
        console.error("Ошибка загрузки данных:", error);
    }

    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('click', onMouseClick, false);
}


function createNodesAndLinks(nodesData) {
  nodesData.forEach((nodeData) => {
      const geometry = new THREE.SphereGeometry(nodeRadius);
      const material = new THREE.MeshBasicMaterial({ color: getColorByLabel(nodeData.node.label) });
      const node = new THREE.Mesh(geometry, material);
      node.position.set(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5);
      node.userData = nodeData.node;
      nodes.push(node);
      scene.add(node);

      nodeData.relations.forEach(({ related_node }) => {
          const targetNode = nodes.find(n => n.userData.id === related_node.id);
          if (targetNode) {
              createLink(node, targetNode);
          }
      });
  });

  camera.position.z = 10;
}

function createLink(fromNode, toNode) {
    const geometry = new THREE.BufferGeometry().setFromPoints([fromNode.position, toNode.position]);
    const material = new THREE.LineBasicMaterial({ color: 0xaaaaaa });
    const line = new THREE.Line(geometry, material);
    links.push(line);
    scene.add(line);
}

function getColorByLabel(label) {
    switch (label) {
        case 'User': return 0x00ff00;
        case 'Group': return 0x0000ff;
        default: return 0xff0000;
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseClick(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  intersects = getIntersects();
  if (intersects.length > 0) {
      const node = intersects[0].object;
      showNodeInfo(node.userData);
  }
}


function getIntersects() {
    raycaster.setFromCamera(mouse, camera);
    return raycaster.intersectObjects(nodes);
}

function showNodeInfo(nodeData) {
  if (selectedNode) {
      selectedNode = null;
  }

  selectedNode = nodeData;

  const relations = Array.isArray(nodeData.relations)
      ? nodeData.relations.map(rel => `- Related to: ${rel.related_node.label} (ID: ${rel.related_node.id})`).join('\n')
      : 'No relations available';

  alert(`Node Info:\nID: ${nodeData.id}\nLabel: ${nodeData.label}\nAttributes: ${JSON.stringify(nodeData.attributes)}\nRelations:\n${relations}`);
}


function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

init();
animate();
