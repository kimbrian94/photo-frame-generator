from setuptools import setup, find_packages

setup(
    name='photo-frame-backend',
    version='0.1',
    packages=find_packages(),
    install_requires=[
        'flask',
        'flask-cors',
        'pillow'
    ],
)
