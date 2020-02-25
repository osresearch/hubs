function isVisibleUpToRoot(node, root) {
  let child = node;
  while (child) {
    if (child === root) return true;
    if (!child.visible) return false;
    child = child.parent;
  }
  console.error(`Root ${root} is not in the hierarchy of node ${node}`);
  return false;
}

export const computeLocalBoundingBox = (function() {
  const rotation = new THREE.Matrix4();
  const xAxis = new THREE.Vector3();
  const yAxis = new THREE.Vector3();
  const zAxis = new THREE.Vector3();
  const position = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  const localCoords = new THREE.Vector3();
  const scale = new THREE.Vector3();
  return function computeLocalBoundingBox(root, box, excludeInvisible) {
    box.makeEmpty();
    root.updateMatrices();
    rotation.extractRotation(root.matrixWorld).extractBasis(xAxis, yAxis, zAxis);
    position.setFromMatrixPosition(root.matrixWorld);
    root.traverse(node => {
      if (excludeInvisible && !isVisibleUpToRoot(node, root)) {
        return;
      }
      node.updateMatrices();
      if (node.geometry) {
        if (node.geometry.isGeometry) {
          for (let i = 0; i < node.geometry.vertices; i++) {
            vertex
              .copy(node.geometry.vertices[i])
              .applyMatrix4(node.matrixWorld)
              .sub(position);
            if (isNaN(vertex.x)) continue;
            localCoords.set(xAxis.dot(vertex), yAxis.dot(vertex), zAxis.dot(vertex));
            box.expandByPoint(localCoords);
          }
        } else if (node.geometry.isBufferGeometry && node.geometry.attributes.position) {
          const array = node.geometry.attributes.position.array;
          const itemSize = node.geometry.attributes.position._itemSize;
          for (let i = 0; i < node.geometry.attributes.position.count; i++) {
            if (itemSize === 2) {
              vertex.set(array[2 * i], array[2 * i + 1], 0);
            } else if (itemSize === 3) {
              vertex.fromBufferAttribute(node.geometry.attributes.position, i);
            } else {
              return;
            }
            vertex.applyMatrix4(node.matrixWorld).sub(position);
            if (isNaN(vertex.x)) continue;
            localCoords.set(xAxis.dot(vertex), yAxis.dot(vertex), zAxis.dot(vertex));
            box.expandByPoint(localCoords);
          }
        }
      }
    });
    scale.setFromMatrixScale(root.matrixWorld);
    box.max.divide(scale);
    box.min.divide(scale);
  };
})();

export const computeObjectAABB = (function() {
  const bounds = new THREE.Box3();
  return function computeObjectAABB(root, target, excludeInvisible) {
    target.makeEmpty();
    root.updateMatrices();
    root.traverse(node => {
      if (excludeInvisible && !isVisibleUpToRoot(node, root)) {
        return;
      }
      node.updateMatrices();
      const geometry = node.geometry;
      if (geometry != null) {
        if (geometry.boundingBox == null) {
          geometry.computeBoundingBox();
        }
        target.union(bounds.copy(geometry.boundingBox).applyMatrix4(node.matrixWorld));
      }
    });
    return target;
  };
})();

const rotation = new THREE.Euler();
export function getBox(entity, boxRoot, worldSpace) {
  const box = new THREE.Box3();

  rotation.copy(entity.object3D.rotation);
  entity.object3D.rotation.set(0, 0, 0);

  entity.object3D.updateMatrices(true, true);
  boxRoot.updateMatrices(true, true);
  boxRoot.updateMatrixWorld(true);

  computeObjectAABB(boxRoot, box, false);

  if (!box.isEmpty()) {
    if (!worldSpace) {
      entity.object3D.worldToLocal(box.min);
      entity.object3D.worldToLocal(box.max);
    }
    entity.object3D.rotation.copy(rotation);
    entity.object3D.matrixNeedsUpdate = true;
  }

  boxRoot.matrixWorldNeedsUpdate = true;
  boxRoot.updateMatrices();

  return box;
}

export function getScaleCoefficient(length, box) {
  if (box.isEmpty()) return 1.0;

  const { max, min } = box;
  const dX = Math.abs(max.x - min.x);
  const dY = Math.abs(max.y - min.y);
  const dZ = Math.abs(max.z - min.z);
  const lengthOfLongestComponent = Math.max(dX, dY, dZ);
  return length / lengthOfLongestComponent;
}
