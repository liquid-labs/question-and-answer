const ibClone = (structure) => {
  if (Array.isArray(structure)) {
    const result = []
    for (const member of structure) {
      result.push(ibClone(member))
    }

    return result
  }

  const structureType = typeof structure
  if (structureType === 'function') {
    return structure
  }

  try {
    return structuredClone(structure)
  }
  catch (e) {
    if (structureType === 'object') {
      const result = {}
      for (const member in structure) {
        result[member] = ibClone(structure[member])
      }

      return result
    }
    // else (though I'm hard pressed to find a situation where this happens)
    throw e
  }
}

export { ibClone }
