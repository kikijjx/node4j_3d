import * as THREE from 'three';
import axios from 'axios';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import pLimit from 'p-limit';

let scene, camera, renderer, controls, raycaster, mouse, intersects;
let nodes = [];
let links = [];
let selectedNode = null;

const nodeRadius = 0.1;


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
  const createdNodes = new Map();

  nodesData.forEach((nodeData) => {
    const mainNode = createNode(nodeData.node);
    createdNodes.set(nodeData.node.id, mainNode);

    nodeData.relations.forEach(({ related_node }) => {
      if (!createdNodes.has(related_node.id)) {
        const relatedNode = createNode(related_node);
        createdNodes.set(related_node.id, relatedNode);
      }

      const fromNode = createdNodes.get(nodeData.node.id);
      const toNode = createdNodes.get(related_node.id);
      createLink(fromNode, toNode);
    });
  });

  arrangeNodes(createdNodes);

  camera.position.z = 10;
}


function arrangeNodes(createdNodes) {
  const maxDistance = 5;
  const repulsionFactor = 0.1;
  const attractionFactor = 0.05;

  createdNodes.forEach((node) => {
    let x = Math.random() * maxDistance * 2 - maxDistance;
    let y = Math.random() * maxDistance * 2 - maxDistance;
    let z = Math.random() * maxDistance * 2 - maxDistance;
    node.position.set(x, y, z);
  });

  createdNodes.forEach((node, nodeId) => {
    let displacement = new THREE.Vector3(0, 0, 0);

    const numRelations = node.userData.relations ? node.userData.relations.length : 0;

    createdNodes.forEach((otherNode, otherNodeId) => {
      if (nodeId !== otherNodeId) {
        const direction = new THREE.Vector3().subVectors(node.position, otherNode.position);
        const distance = direction.length();
        
        if (distance < maxDistance) {
          const force = repulsionFactor / Math.pow(distance, 2);
          direction.normalize().multiplyScalar(force);
          displacement.add(direction);
        }
      }
    });

    if (node.userData.relations) {
      node.userData.relations.forEach(({ related_node }) => {
        const relatedNode = createdNodes.get(related_node.id);
        if (relatedNode) {
          const direction = new THREE.Vector3().subVectors(relatedNode.position, node.position);
          const distance = direction.length();

          const attractionForce = Math.max(0, maxDistance - distance) / maxDistance * attractionFactor * numRelations;
          direction.normalize().multiplyScalar(attractionForce);
          displacement.add(direction);
        }
      });
    }

    node.position.add(displacement);
  });
}





function createNode(nodeData) {
  const geometry = new THREE.SphereGeometry(nodeRadius);
  const material = new THREE.MeshBasicMaterial({ color: getColorByLabel(nodeData.label) });
  const node = new THREE.Mesh(geometry, material);
  node.position.set(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5);
  node.userData = nodeData;
  nodes.push(node);
  scene.add(node);
  return node;
}


function createLink(fromNode, toNode) {
  if (!fromNode || !toNode) {
    console.warn("Cannot create link: one of the nodes is missing.", { fromNode, toNode });
    return;
  }

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

  const attributes = nodeData.attributes || {};
  const id = attributes.id || "N/A";
  const label = nodeData.label || "Unknown";
  const screenName = attributes.screen_name || "N/A";
  const name = attributes.name || "N/A";
  const city = attributes.city || "N/A";

  let relationsInfo = "No relations available";
  if (nodeData.relations && nodeData.relations.length > 0) {
    relationsInfo = nodeData.relations
      .map(rel => `- Related to ID: ${rel.related_node.id}, Label: ${rel.related_node.label}`)
      .join('\n');
  }

  alert(
    `Node Info:
ID: ${id}
Label: ${label}
Screen Name: ${screenName}
Name: ${name}
City: ${city}
Relations:
${relationsInfo}`
  );
}



function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

init();
animate();
